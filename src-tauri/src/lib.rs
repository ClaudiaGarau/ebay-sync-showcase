mod accounts;
mod amazon;
mod db;
mod ebay;
mod oauth_server;

use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            let conn = db::init(&app_data_dir)?;
            app.manage(db::DbState(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ebay::ebay_save_app_credentials,
            ebay::ebay_get_app_credentials_status,
            ebay::ebay_clear_app_credentials,
            ebay::ebay_connect_account,
            ebay::ebay_sync_products,
            ebay::ebay_sync_orders,
            amazon::amazon_save_app_credentials,
            amazon::amazon_get_app_credentials_status,
            amazon::amazon_clear_app_credentials,
            amazon::amazon_connect_account,
            amazon::amazon_sync_products,
            amazon::amazon_sync_orders,
            accounts::list_marketplace_accounts,
            accounts::marketplace_dashboard,
            accounts::disconnect_marketplace_account,
            accounts::rename_marketplace_account,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
