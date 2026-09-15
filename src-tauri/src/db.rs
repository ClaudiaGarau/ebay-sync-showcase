use std::path::Path;
use std::sync::Mutex;

use rusqlite::Connection;
use serde::{Deserialize, Serialize};

pub struct DbState(pub Mutex<Connection>);

pub fn init(app_data_dir: &Path) -> Result<Connection, String> {
    std::fs::create_dir_all(app_data_dir)
        .map_err(|err| format!("Impossibile creare la cartella dati dell'app: {err}"))?;

    let db_path = app_data_dir.join("ebaysync.sqlite3");
    let conn = Connection::open(&db_path)
        .map_err(|err| format!("Impossibile aprire il database locale: {err}"))?;

    conn.execute_batch(
        "
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS marketplace_accounts (
            id                      TEXT PRIMARY KEY,
            marketplace_type        TEXT NOT NULL,
            environment             TEXT NOT NULL,
            nickname                TEXT NOT NULL,
            external_account_id     TEXT,
            status                  TEXT NOT NULL,
            connected_at            TEXT NOT NULL,
            last_sync_products_at   TEXT,
            last_sync_orders_at     TEXT,
            last_error              TEXT
        );

        CREATE TABLE IF NOT EXISTS synced_listings (
            id                   TEXT PRIMARY KEY,
            account_id           TEXT NOT NULL REFERENCES marketplace_accounts(id) ON DELETE CASCADE,
            marketplace_type     TEXT NOT NULL,
            external_listing_id  TEXT NOT NULL,
            title                TEXT NOT NULL,
            status               TEXT NOT NULL,
            price_amount         REAL,
            price_currency       TEXT,
            quantity             INTEGER,
            raw_json             TEXT NOT NULL,
            synced_at            TEXT NOT NULL,
            UNIQUE(account_id, external_listing_id)
        );

        CREATE TABLE IF NOT EXISTS synced_orders (
            id                 TEXT PRIMARY KEY,
            account_id         TEXT NOT NULL REFERENCES marketplace_accounts(id) ON DELETE CASCADE,
            marketplace_type   TEXT NOT NULL,
            external_order_id  TEXT NOT NULL,
            status             TEXT NOT NULL,
            total_amount       REAL,
            total_currency     TEXT,
            buyer_name         TEXT,
            placed_at          TEXT,
            raw_json           TEXT NOT NULL,
            synced_at          TEXT NOT NULL,
            UNIQUE(account_id, external_order_id)
        );
        ",
    )
    .map_err(|err| format!("Impossibile inizializzare lo schema del database: {err}"))?;

    Ok(conn)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MarketplaceType {
    Ebay,
    Amazon,
}

impl MarketplaceType {
    pub fn as_str(self) -> &'static str {
        match self {
            MarketplaceType::Ebay => "ebay",
            MarketplaceType::Amazon => "amazon",
        }
    }

    pub fn parse(value: &str) -> Result<Self, String> {
        match value {
            "ebay" => Ok(MarketplaceType::Ebay),
            "amazon" => Ok(MarketplaceType::Amazon),
            other => Err(format!("Tipo di marketplace non valido: \"{other}\"")),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AccountStatus {
    Connected,
    Syncing,
    TokenExpired,
    Error,
}

impl AccountStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            AccountStatus::Connected => "connected",
            AccountStatus::Syncing => "syncing",
            AccountStatus::TokenExpired => "token_expired",
            AccountStatus::Error => "error",
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct MarketplaceAccount {
    pub id: String,
    pub marketplace_type: String,
    pub environment: String,
    pub nickname: String,
    pub external_account_id: Option<String>,
    pub status: String,
    pub connected_at: String,
    pub last_sync_products_at: Option<String>,
    pub last_sync_orders_at: Option<String>,
    pub last_error: Option<String>,
}

fn row_to_account(row: &rusqlite::Row) -> rusqlite::Result<MarketplaceAccount> {
    Ok(MarketplaceAccount {
        id: row.get("id")?,
        marketplace_type: row.get("marketplace_type")?,
        environment: row.get("environment")?,
        nickname: row.get("nickname")?,
        external_account_id: row.get("external_account_id")?,
        status: row.get("status")?,
        connected_at: row.get("connected_at")?,
        last_sync_products_at: row.get("last_sync_products_at")?,
        last_sync_orders_at: row.get("last_sync_orders_at")?,
        last_error: row.get("last_error")?,
    })
}

pub struct NewAccount<'a> {
    pub id: &'a str,
    pub marketplace_type: MarketplaceType,
    pub environment: &'a str,
    pub nickname: &'a str,
    pub external_account_id: Option<&'a str>,
}

pub fn insert_account(conn: &Connection, account: NewAccount) -> Result<MarketplaceAccount, String> {
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO marketplace_accounts
            (id, marketplace_type, environment, nickname, external_account_id, status, connected_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            account.id,
            account.marketplace_type.as_str(),
            account.environment,
            account.nickname,
            account.external_account_id,
            AccountStatus::Connected.as_str(),
            now,
        ],
    )
    .map_err(|err| format!("Impossibile salvare l'account: {err}"))?;

    get_account(conn, account.id)?.ok_or_else(|| "Account appena creato non trovato".to_string())
}

pub fn get_account(conn: &Connection, id: &str) -> Result<Option<MarketplaceAccount>, String> {
    conn.query_row(
        "SELECT * FROM marketplace_accounts WHERE id = ?1",
        [id],
        row_to_account,
    )
    .map(Some)
    .or_else(|err| match err {
        rusqlite::Error::QueryReturnedNoRows => Ok(None),
        other => Err(format!("Impossibile leggere l'account: {other}")),
    })
}

pub fn list_accounts(conn: &Connection) -> Result<Vec<MarketplaceAccount>, String> {
    let mut stmt = conn
        .prepare("SELECT * FROM marketplace_accounts ORDER BY connected_at ASC")
        .map_err(|err| format!("Impossibile leggere gli account: {err}"))?;

    let rows = stmt
        .query_map([], row_to_account)
        .map_err(|err| format!("Impossibile leggere gli account: {err}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|err| format!("Impossibile leggere gli account: {err}"))
}

pub fn delete_account(conn: &Connection, id: &str) -> Result<(), String> {
    conn.execute("DELETE FROM marketplace_accounts WHERE id = ?1", [id])
        .map_err(|err| format!("Impossibile rimuovere l'account: {err}"))?;
    Ok(())
}

pub fn set_account_status(
    conn: &Connection,
    id: &str,
    status: AccountStatus,
    last_error: Option<&str>,
) -> Result<(), String> {
    conn.execute(
        "UPDATE marketplace_accounts SET status = ?1, last_error = ?2 WHERE id = ?3",
        rusqlite::params![status.as_str(), last_error, id],
    )
    .map_err(|err| format!("Impossibile aggiornare lo stato dell'account: {err}"))?;
    Ok(())
}

pub fn mark_account_connected(
    conn: &Connection,
    id: &str,
    external_account_id: Option<&str>,
) -> Result<(), String> {
    conn.execute(
        "UPDATE marketplace_accounts
         SET status = ?1, last_error = NULL, external_account_id = COALESCE(?2, external_account_id)
         WHERE id = ?3",
        rusqlite::params![AccountStatus::Connected.as_str(), external_account_id, id],
    )
    .map_err(|err| format!("Impossibile aggiornare l'account: {err}"))?;
    Ok(())
}

pub fn set_account_nickname(conn: &Connection, id: &str, nickname: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE marketplace_accounts SET nickname = ?1 WHERE id = ?2",
        rusqlite::params![nickname, id],
    )
    .map_err(|err| format!("Impossibile rinominare l'account: {err}"))?;
    Ok(())
}

#[derive(Debug, Serialize)]
pub struct ListingStats {
    pub total: i64,
    pub active: i64,
}

pub fn listing_stats_for_account(conn: &Connection, account_id: &str) -> Result<ListingStats, String> {
    let total: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM synced_listings WHERE account_id = ?1",
            [account_id],
            |row| row.get(0),
        )
        .map_err(|err| format!("Impossibile leggere le inserzioni: {err}"))?;
    let active: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM synced_listings WHERE account_id = ?1 AND status = 'active'",
            [account_id],
            |row| row.get(0),
        )
        .map_err(|err| format!("Impossibile leggere le inserzioni: {err}"))?;
    Ok(ListingStats { total, active })
}

pub struct SyncedListing {
    pub external_listing_id: String,
    pub title: String,
    pub status: String,
    pub price_amount: Option<f64>,
    pub price_currency: Option<String>,
    pub quantity: Option<i64>,
    pub raw_json: String,
}

pub fn upsert_listings(
    conn: &mut Connection,
    account_id: &str,
    marketplace_type: MarketplaceType,
    listings: &[SyncedListing],
) -> Result<usize, String> {
    let now = chrono::Utc::now().to_rfc3339();
    let tx = conn
        .transaction()
        .map_err(|err| format!("Impossibile avviare la transazione: {err}"))?;

    for listing in listings {
        tx.execute(
            "INSERT INTO synced_listings
                (id, account_id, marketplace_type, external_listing_id, title, status,
                 price_amount, price_currency, quantity, raw_json, synced_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
             ON CONFLICT(account_id, external_listing_id) DO UPDATE SET
                title = excluded.title,
                status = excluded.status,
                price_amount = excluded.price_amount,
                price_currency = excluded.price_currency,
                quantity = excluded.quantity,
                raw_json = excluded.raw_json,
                synced_at = excluded.synced_at",
            rusqlite::params![
                uuid::Uuid::new_v4().to_string(),
                account_id,
                marketplace_type.as_str(),
                listing.external_listing_id,
                listing.title,
                listing.status,
                listing.price_amount,
                listing.price_currency,
                listing.quantity,
                listing.raw_json,
                now,
            ],
        )
        .map_err(|err| format!("Impossibile salvare l'inserzione sincronizzata: {err}"))?;
    }

    tx.execute(
        "UPDATE marketplace_accounts SET last_sync_products_at = ?1 WHERE id = ?2",
        rusqlite::params![now, account_id],
    )
    .map_err(|err| format!("Impossibile aggiornare la data di sincronizzazione: {err}"))?;

    tx.commit()
        .map_err(|err| format!("Impossibile confermare la transazione: {err}"))?;

    Ok(listings.len())
}

pub struct SyncedOrder {
    pub external_order_id: String,
    pub status: String,
    pub total_amount: Option<f64>,
    pub total_currency: Option<String>,
    pub buyer_name: Option<String>,
    pub placed_at: Option<String>,
    pub raw_json: String,
}

pub fn upsert_orders(
    conn: &mut Connection,
    account_id: &str,
    marketplace_type: MarketplaceType,
    orders: &[SyncedOrder],
) -> Result<usize, String> {
    let now = chrono::Utc::now().to_rfc3339();
    let tx = conn
        .transaction()
        .map_err(|err| format!("Impossibile avviare la transazione: {err}"))?;

    for order in orders {
        tx.execute(
            "INSERT INTO synced_orders
                (id, account_id, marketplace_type, external_order_id, status,
                 total_amount, total_currency, buyer_name, placed_at, raw_json, synced_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
             ON CONFLICT(account_id, external_order_id) DO UPDATE SET
                status = excluded.status,
                total_amount = excluded.total_amount,
                total_currency = excluded.total_currency,
                buyer_name = excluded.buyer_name,
                placed_at = excluded.placed_at,
                raw_json = excluded.raw_json,
                synced_at = excluded.synced_at",
            rusqlite::params![
                uuid::Uuid::new_v4().to_string(),
                account_id,
                marketplace_type.as_str(),
                order.external_order_id,
                order.status,
                order.total_amount,
                order.total_currency,
                order.buyer_name,
                order.placed_at,
                order.raw_json,
                now,
            ],
        )
        .map_err(|err| format!("Impossibile salvare l'ordine sincronizzato: {err}"))?;
    }

    tx.execute(
        "UPDATE marketplace_accounts SET last_sync_orders_at = ?1 WHERE id = ?2",
        rusqlite::params![now, account_id],
    )
    .map_err(|err| format!("Impossibile aggiornare la data di sincronizzazione: {err}"))?;

    tx.commit()
        .map_err(|err| format!("Impossibile confermare la transazione: {err}"))?;

    Ok(orders.len())
}
