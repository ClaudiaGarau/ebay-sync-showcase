use std::time::Duration;

use base64::Engine;
use keyring::Entry;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;

use crate::db::{self, DbState, MarketplaceAccount, MarketplaceType};
use crate::oauth_server;

const KEYRING_SERVICE: &str = "ebaysync";
const OAUTH_CALLBACK_PORT: u16 = 17872;
const OAUTH_TIMEOUT: Duration = Duration::from_secs(300);

const OAUTH_SCOPES: &str = "https://api.ebay.com/oauth/api_scope \
https://api.ebay.com/oauth/api_scope/sell.inventory \
https://api.ebay.com/oauth/api_scope/sell.fulfillment \
https://api.ebay.com/oauth/api_scope/commerce.identity.readonly";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Environment {
    Sandbox,
    Production,
}

impl Environment {
    fn parse(value: &str) -> Result<Self, String> {
        match value {
            "sandbox" => Ok(Environment::Sandbox),
            "production" => Ok(Environment::Production),
            other => Err(format!("Ambiente non valido: \"{other}\"")),
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Environment::Sandbox => "sandbox",
            Environment::Production => "production",
        }
    }

    fn keyring_username(self) -> &'static str {
        match self {
            Environment::Sandbox => "ebay.sandbox.app_credentials",
            Environment::Production => "ebay.production.app_credentials",
        }
    }

    fn authorize_base(self) -> &'static str {
        match self {
            Environment::Sandbox => "https://auth.sandbox.ebay.com/oauth2/authorize",
            Environment::Production => "https://auth.ebay.com/oauth2/authorize",
        }
    }

    fn token_url(self) -> &'static str {
        match self {
            Environment::Sandbox => "https://api.sandbox.ebay.com/identity/v1/oauth2/token",
            Environment::Production => "https://api.ebay.com/identity/v1/oauth2/token",
        }
    }

    fn identity_url(self) -> &'static str {
        match self {
            Environment::Sandbox => "https://apiz.sandbox.ebay.com/commerce/identity/v1/user",
            Environment::Production => "https://apiz.ebay.com/commerce/identity/v1/user",
        }
    }

    pub(crate) fn api_base(self) -> &'static str {
        match self {
            Environment::Sandbox => "https://api.sandbox.ebay.com",
            Environment::Production => "https://api.ebay.com",
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct StoredEbayAppCredentials {
    client_id: String,
    client_secret: String,
    ru_name: String,
}

#[derive(Debug, Serialize)]
pub struct EbayCredentialsStatus {
    configured: bool,
    client_id_hint: Option<String>,
}

fn entry_for(environment: Environment) -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, environment.keyring_username())
        .map_err(|err| format!("Impossibile accedere al keychain di sistema: {err}"))
}

fn mask_client_id(client_id: &str) -> String {
    let visible: String = client_id.chars().rev().take(4).collect();
    let visible: String = visible.chars().rev().collect();
    format!("…{visible}")
}

fn load_app_credentials(environment: Environment) -> Result<StoredEbayAppCredentials, String> {
    match entry_for(environment)?.get_password() {
        Ok(serialized) => serde_json::from_str(&serialized)
            .map_err(|err| format!("Credenziali salvate corrotte: {err}")),
        Err(keyring::Error::NoEntry) => Err(
            "Configura prima le credenziali dell'app eBay in Impostazioni.".to_string(),
        ),
        Err(err) => Err(format!("Impossibile leggere le credenziali dal keychain: {err}")),
    }
}

#[tauri::command]
pub fn ebay_save_app_credentials(
    environment: String,
    client_id: String,
    client_secret: String,
    ru_name: String,
) -> Result<(), String> {
    let environment = Environment::parse(&environment)?;

    if client_id.trim().is_empty() || client_secret.trim().is_empty() || ru_name.trim().is_empty() {
        return Err("Client ID, Client Secret e RuName sono tutti obbligatori.".into());
    }

    let credentials = StoredEbayAppCredentials {
        client_id: client_id.trim().to_string(),
        client_secret: client_secret.trim().to_string(),
        ru_name: ru_name.trim().to_string(),
    };
    let serialized = serde_json::to_string(&credentials)
        .map_err(|err| format!("Impossibile serializzare le credenziali: {err}"))?;

    entry_for(environment)?
        .set_password(&serialized)
        .map_err(|err| format!("Impossibile salvare le credenziali nel keychain: {err}"))
}

#[tauri::command]
pub fn ebay_get_app_credentials_status(environment: String) -> Result<EbayCredentialsStatus, String> {
    let environment = Environment::parse(&environment)?;

    match entry_for(environment)?.get_password() {
        Ok(serialized) => {
            let credentials: StoredEbayAppCredentials = serde_json::from_str(&serialized)
                .map_err(|err| format!("Credenziali salvate corrotte: {err}"))?;
            Ok(EbayCredentialsStatus {
                configured: true,
                client_id_hint: Some(mask_client_id(&credentials.client_id)),
            })
        }
        Err(keyring::Error::NoEntry) => Ok(EbayCredentialsStatus {
            configured: false,
            client_id_hint: None,
        }),
        Err(err) => Err(format!("Impossibile leggere le credenziali dal keychain: {err}")),
    }
}

#[tauri::command]
pub fn ebay_clear_app_credentials(environment: String) -> Result<(), String> {
    let environment = Environment::parse(&environment)?;

    match entry_for(environment)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(format!("Impossibile rimuovere le credenziali dal keychain: {err}")),
    }
}

fn account_token_entry(account_id: &str) -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, &format!("ebay.account.{account_id}"))
        .map_err(|err| format!("Impossibile accedere al keychain di sistema: {err}"))
}

pub fn delete_account_token(account_id: &str) -> Result<(), String> {
    match account_token_entry(account_id)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(format!("Impossibile rimuovere il token dal keychain: {err}")),
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct StoredAccountTokens {
    access_token: String,
    refresh_token: String,
    expires_at: String,
    environment: String,
}

fn save_account_tokens(account_id: &str, tokens: &StoredAccountTokens) -> Result<(), String> {
    let serialized = serde_json::to_string(tokens)
        .map_err(|err| format!("Impossibile serializzare il token: {err}"))?;
    account_token_entry(account_id)?
        .set_password(&serialized)
        .map_err(|err| format!("Impossibile salvare il token nel keychain: {err}"))
}

fn load_account_tokens(account_id: &str) -> Result<StoredAccountTokens, String> {
    match account_token_entry(account_id)?.get_password() {
        Ok(serialized) => serde_json::from_str(&serialized)
            .map_err(|err| format!("Token salvato corrotto: {err}")),
        Err(keyring::Error::NoEntry) => {
            Err("Nessun token salvato per questo account. Riconnetti l'account.".to_string())
        }
        Err(err) => Err(format!("Impossibile leggere il token dal keychain: {err}")),
    }
}

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    expires_in: i64,
    #[serde(default)]
    refresh_token: Option<String>,
}

fn exchange_code_for_tokens(
    client: &reqwest::blocking::Client,
    environment: Environment,
    app_credentials: &StoredEbayAppCredentials,
    code: &str,
) -> Result<TokenResponse, String> {
    let basic = base64::engine::general_purpose::STANDARD.encode(format!(
        "{}:{}",
        app_credentials.client_id, app_credentials.client_secret
    ));

    let response = client
        .post(environment.token_url())
        .header("Authorization", format!("Basic {basic}"))
        .header("Content-Type", "application/x-www-form-urlencoded")
        .form(&[
            ("grant_type", "authorization_code"),
            ("code", code),
            ("redirect_uri", &app_credentials.ru_name),
        ])
        .send()
        .map_err(|err| format!("Richiesta di scambio del codice fallita: {err}"))?;

    parse_token_response(response)
}

fn refresh_access_token(
    client: &reqwest::blocking::Client,
    environment: Environment,
    app_credentials: &StoredEbayAppCredentials,
    refresh_token: &str,
) -> Result<TokenResponse, String> {
    let basic = base64::engine::general_purpose::STANDARD.encode(format!(
        "{}:{}",
        app_credentials.client_id, app_credentials.client_secret
    ));

    let response = client
        .post(environment.token_url())
        .header("Authorization", format!("Basic {basic}"))
        .header("Content-Type", "application/x-www-form-urlencoded")
        .form(&[
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
            ("scope", OAUTH_SCOPES),
        ])
        .send()
        .map_err(|err| format!("Richiesta di rinnovo del token fallita: {err}"))?;

    parse_token_response(response)
}

fn parse_token_response(response: reqwest::blocking::Response) -> Result<TokenResponse, String> {
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().unwrap_or_default();
        return Err(format!("eBay ha rifiutato la richiesta ({status}): {body}"));
    }
    response
        .json::<TokenResponse>()
        .map_err(|err| format!("Risposta token non valida: {err}"))
}

#[derive(Debug, Deserialize)]
struct EbayIdentity {
    username: Option<String>,
    #[serde(rename = "userId")]
    user_id: Option<String>,
}

fn fetch_identity(
    client: &reqwest::blocking::Client,
    environment: Environment,
    access_token: &str,
) -> Result<Option<String>, String> {
    let response = client
        .get(environment.identity_url())
        .header("Authorization", format!("Bearer {access_token}"))
        .send()
        .map_err(|err| format!("Richiesta identità fallita: {err}"))?;

    if !response.status().is_success() {
        // Non fatale: l'account resta collegato anche senza nickname suggerito.
        return Ok(None);
    }

    let identity: EbayIdentity = response
        .json()
        .map_err(|err| format!("Risposta identità non valida: {err}"))?;

    Ok(identity.username.or(identity.user_id))
}

/// Avvia il flusso OAuth completo per collegare un account eBay: apre il browser di
/// sistema sulla pagina di consenso eBay, attende il redirect locale con il codice di
/// autorizzazione, lo scambia per i token e salva l'account. Se `existing_account_id`
/// è fornito, riautorizza (riconnette) quell'account invece di crearne uno nuovo.
#[tauri::command]
pub fn ebay_connect_account(
    environment: String,
    existing_account_id: Option<String>,
    app: AppHandle,
    db: State<DbState>,
) -> Result<MarketplaceAccount, String> {
    let environment = Environment::parse(&environment)?;
    let app_credentials = load_app_credentials(environment)?;

    let client_id_for_auth = app_credentials.client_id.clone();
    let ru_name = app_credentials.ru_name.clone();
    let state = uuid::Uuid::new_v4().to_string();
    let authorize_url = build_authorize_url_with_client_id(
        environment,
        &client_id_for_auth,
        &ru_name,
        &state,
    );

    let app_for_browser = app.clone();
    let query = oauth_server::receive_one_callback(OAUTH_CALLBACK_PORT, OAUTH_TIMEOUT, || {
        if let Err(err) = app_for_browser.opener().open_url(authorize_url.clone(), None::<&str>) {
            eprintln!("Impossibile aprire il browser di sistema: {err}");
        }
    })?;

    let returned_state = query.get("state").map(String::as_str).unwrap_or_default();
    if returned_state != state {
        return Err("Parametro state non corrispondente: possibile tentativo non autorizzato.".to_string());
    }
    let code = query
        .get("code")
        .ok_or_else(|| "Nessun codice di autorizzazione ricevuto da eBay.".to_string())?;

    let client = reqwest::blocking::Client::new();
    let tokens = exchange_code_for_tokens(&client, environment, &app_credentials, code)?;
    let identity = fetch_identity(&client, environment, &tokens.access_token).unwrap_or(None);

    let expires_at = (chrono::Utc::now() + chrono::Duration::seconds(tokens.expires_in)).to_rfc3339();
    let refresh_token = tokens
        .refresh_token
        .ok_or_else(|| "eBay non ha restituito un refresh token.".to_string())?;

    let conn = db.0.lock().map_err(|_| "Database non accessibile".to_string())?;

    let account = match existing_account_id {
        Some(id) => {
            save_account_tokens(
                &id,
                &StoredAccountTokens {
                    access_token: tokens.access_token,
                    refresh_token,
                    expires_at,
                    environment: environment.as_str().to_string(),
                },
            )?;
            db::mark_account_connected(&conn, &id, identity.as_deref())?;
            db::get_account(&conn, &id)?.ok_or_else(|| "Account non trovato dopo la riconnessione.".to_string())?
        }
        None => {
            let id = uuid::Uuid::new_v4().to_string();
            save_account_tokens(
                &id,
                &StoredAccountTokens {
                    access_token: tokens.access_token,
                    refresh_token,
                    expires_at,
                    environment: environment.as_str().to_string(),
                },
            )?;
            db::insert_account(
                &conn,
                db::NewAccount {
                    id: &id,
                    marketplace_type: MarketplaceType::Ebay,
                    environment: environment.as_str(),
                    nickname: identity.as_deref().unwrap_or("Account eBay"),
                    external_account_id: identity.as_deref(),
                },
            )?
        }
    };

    Ok(account)
}

fn build_authorize_url_with_client_id(
    environment: Environment,
    client_id: &str,
    ru_name: &str,
    state: &str,
) -> String {
    let mut url = url::Url::parse(environment.authorize_base()).expect("URL base valido");
    url.query_pairs_mut()
        .append_pair("client_id", client_id)
        .append_pair("redirect_uri", ru_name)
        .append_pair("response_type", "code")
        .append_pair("scope", OAUTH_SCOPES)
        .append_pair("state", state);
    url.to_string()
}

/// Restituisce un access token valido per l'account, rinnovandolo tramite il refresh
/// token salvato se necessario. Usato dalle funzioni di sincronizzazione.
pub fn get_valid_access_token(account_id: &str) -> Result<String, String> {
    let tokens = load_account_tokens(account_id)?;
    let environment = Environment::parse(&tokens.environment)?;

    let expires_at = chrono::DateTime::parse_from_rfc3339(&tokens.expires_at)
        .map_err(|err| format!("Data di scadenza del token non valida: {err}"))?;
    let still_valid = chrono::Utc::now() + chrono::Duration::seconds(60) < expires_at;

    if still_valid {
        return Ok(tokens.access_token);
    }

    let app_credentials = load_app_credentials(environment)?;
    let client = reqwest::blocking::Client::new();
    let refreshed = refresh_access_token(&client, environment, &app_credentials, &tokens.refresh_token)?;

    let expires_at = (chrono::Utc::now() + chrono::Duration::seconds(refreshed.expires_in)).to_rfc3339();
    let new_refresh_token = refreshed.refresh_token.unwrap_or(tokens.refresh_token);

    save_account_tokens(
        account_id,
        &StoredAccountTokens {
            access_token: refreshed.access_token.clone(),
            refresh_token: new_refresh_token,
            expires_at,
            environment: tokens.environment,
        },
    )?;

    Ok(refreshed.access_token)
}

fn build_url(base: &str, path: &str, query: &[(&str, &str)]) -> String {
    let mut url = url::Url::parse(base).expect("base URL valido").join(path).expect("path valido");
    {
        let mut pairs = url.query_pairs_mut();
        for (key, value) in query {
            pairs.append_pair(key, value);
        }
    }
    url.to_string()
}

fn ebay_get_json(
    client: &reqwest::blocking::Client,
    url: &str,
    access_token: &str,
) -> Result<serde_json::Value, String> {
    let response = client
        .get(url)
        .header("Authorization", format!("Bearer {access_token}"))
        .header("Content-Language", "en-US")
        .header("Accept", "application/json")
        .send()
        .map_err(|err| format!("Richiesta a eBay fallita: {err}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().unwrap_or_default();
        return Err(format!("eBay ha risposto con un errore ({status}): {body}"));
    }

    response
        .json::<serde_json::Value>()
        .map_err(|err| format!("Risposta eBay non valida: {err}"))
}

fn map_offer_status(status: &str) -> &'static str {
    if status.eq_ignore_ascii_case("PUBLISHED") {
        "active"
    } else {
        "inactive"
    }
}

fn account_environment(db: &State<DbState>, account_id: &str) -> Result<Environment, String> {
    let conn = db.0.lock().map_err(|_| "Database non accessibile".to_string())?;
    let account = db::get_account(&conn, account_id)?
        .ok_or_else(|| "Account non trovato.".to_string())?;
    Environment::parse(&account.environment)
}

/// Su successo marca l'account come connesso; su errore lo marca in errore con il
/// messaggio, così che l'interfaccia possa mostrare lo stato e offrire "Riconnetti".
fn run_sync<T>(db: &State<DbState>, account_id: &str, f: impl FnOnce() -> Result<T, String>) -> Result<T, String> {
    match f() {
        Ok(value) => {
            if let Ok(conn) = db.0.lock() {
                let _ = db::mark_account_connected(&conn, account_id, None);
            }
            Ok(value)
        }
        Err(err) => {
            if let Ok(conn) = db.0.lock() {
                let _ = db::set_account_status(&conn, account_id, db::AccountStatus::Error, Some(&err));
            }
            Err(err)
        }
    }
}

/// Importa tutte le inserzioni attive dell'account: recupera gli inventory item (SKU,
/// titolo, quantità) e per ciascuno la relativa offerta (prezzo, stato, listing id)
/// dalla Sell Inventory API, poi le salva nel database locale.
#[tauri::command]
pub fn ebay_sync_products(account_id: String, db: State<DbState>) -> Result<usize, String> {
    let environment = account_environment(&db, &account_id)?;

    run_sync(&db, &account_id, || {
        let access_token = get_valid_access_token(&account_id)?;
        let client = reqwest::blocking::Client::new();
        let base = environment.api_base();

        let mut inventory_items: Vec<(String, String, Option<i64>)> = Vec::new();
        let limit = 100i64;
        let mut offset = 0i64;
        loop {
            let url = build_url(
                base,
                "/sell/inventory/v1/inventory_item",
                &[("limit", &limit.to_string()), ("offset", &offset.to_string())],
            );
            let page = ebay_get_json(&client, &url, &access_token)?;
            let items = page
                .get("inventoryItems")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();
            if items.is_empty() {
                break;
            }
            for item in &items {
                let sku = item.get("sku").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                if sku.is_empty() {
                    continue;
                }
                let title = item
                    .pointer("/product/title")
                    .and_then(|v| v.as_str())
                    .unwrap_or("(senza titolo)")
                    .to_string();
                let quantity = item
                    .pointer("/availability/shipToLocationAvailability/quantity")
                    .and_then(|v| v.as_i64());
                inventory_items.push((sku, title, quantity));
            }
            let total = page.get("total").and_then(|v| v.as_i64()).unwrap_or(0);
            offset += limit;
            if offset >= total || offset > 5000 {
                break;
            }
        }

        let mut listings = Vec::new();
        for (sku, title, quantity) in inventory_items {
            let offer_url = build_url(base, "/sell/inventory/v1/offer", &[("sku", &sku)]);
            let offer_page = match ebay_get_json(&client, &offer_url, &access_token) {
                Ok(v) => v,
                Err(_) => continue,
            };
            let offers = offer_page
                .get("offers")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();
            for offer in offers {
                let status = offer.get("status").and_then(|v| v.as_str()).unwrap_or("UNPUBLISHED");
                let price_amount = offer
                    .pointer("/pricingSummary/price/value")
                    .and_then(|v| v.as_str())
                    .and_then(|s| s.parse::<f64>().ok());
                let price_currency = offer
                    .pointer("/pricingSummary/price/currency")
                    .and_then(|v| v.as_str())
                    .map(str::to_string);
                let external_id = offer
                    .get("listingId")
                    .and_then(|v| v.as_str())
                    .map(str::to_string)
                    .unwrap_or_else(|| sku.clone());

                listings.push(db::SyncedListing {
                    external_listing_id: external_id,
                    title: title.clone(),
                    status: map_offer_status(status).to_string(),
                    price_amount,
                    price_currency,
                    quantity,
                    raw_json: offer.to_string(),
                });
            }
        }

        let mut conn = db.0.lock().map_err(|_| "Database non accessibile".to_string())?;
        db::upsert_listings(&mut conn, &account_id, MarketplaceType::Ebay, &listings)
    })
}

/// Scarica gli ordini attivi (non ancora completati) dell'account dalla Fulfillment
/// API e li salva nel database locale.
#[tauri::command]
pub fn ebay_sync_orders(account_id: String, db: State<DbState>) -> Result<usize, String> {
    let environment = account_environment(&db, &account_id)?;

    run_sync(&db, &account_id, || {
        let access_token = get_valid_access_token(&account_id)?;
        let client = reqwest::blocking::Client::new();
        let base = environment.api_base();

        let mut orders_out = Vec::new();
        let limit = 50i64;
        let mut offset = 0i64;
        loop {
            let url = build_url(
                base,
                "/sell/fulfillment/v1/order",
                &[
                    ("filter", "orderfulfillmentstatus:{NOT_STARTED|IN_PROGRESS}"),
                    ("limit", &limit.to_string()),
                    ("offset", &offset.to_string()),
                ],
            );
            let page = ebay_get_json(&client, &url, &access_token)?;
            let orders = page.get("orders").and_then(|v| v.as_array()).cloned().unwrap_or_default();
            if orders.is_empty() {
                break;
            }
            for order in &orders {
                let order_id = order.get("orderId").and_then(|v| v.as_str()).unwrap_or_default().to_string();
                if order_id.is_empty() {
                    continue;
                }
                let status = order
                    .get("orderFulfillmentStatus")
                    .and_then(|v| v.as_str())
                    .unwrap_or("UNKNOWN")
                    .to_string();
                let total_amount = order
                    .pointer("/pricingSummary/total/value")
                    .and_then(|v| v.as_str())
                    .and_then(|s| s.parse::<f64>().ok());
                let total_currency = order
                    .pointer("/pricingSummary/total/currency")
                    .and_then(|v| v.as_str())
                    .map(str::to_string);
                let buyer_name = order
                    .pointer("/buyer/username")
                    .and_then(|v| v.as_str())
                    .map(str::to_string);
                let placed_at = order.get("creationDate").and_then(|v| v.as_str()).map(str::to_string);

                orders_out.push(db::SyncedOrder {
                    external_order_id: order_id,
                    status,
                    total_amount,
                    total_currency,
                    buyer_name,
                    placed_at,
                    raw_json: order.to_string(),
                });
            }
            let total = page.get("total").and_then(|v| v.as_i64()).unwrap_or(0);
            offset += limit;
            if offset >= total || offset > 5000 {
                break;
            }
        }

        let mut conn = db.0.lock().map_err(|_| "Database non accessibile".to_string())?;
        db::upsert_orders(&mut conn, &account_id, MarketplaceType::Ebay, &orders_out)
    })
}
