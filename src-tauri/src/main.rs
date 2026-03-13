// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use colored::Colorize;
use log::{debug, info};

fn init_logger(debug: bool) {
    use std::io::Write;
    
    let level = if debug {
        log::LevelFilter::Debug
    } else {
        log::LevelFilter::Info
    };
    
    env_logger::Builder::from_default_env()
        .filter_level(level)
        .format(|buf, record| {
            let level_colored = match record.level() {
                log::Level::Error => record.level().to_string().red(),
                log::Level::Warn => record.level().to_string().yellow(),
                log::Level::Info => record.level().to_string().green(),
                log::Level::Debug => record.level().to_string().cyan(),
                log::Level::Trace => record.level().to_string().purple(),
            };
            
            writeln!(
                buf,
                "{} {} {}: {}",
                "[prism]".bold(),
                level_colored,
                record.target(),
                record.args()
            )
        })
        .init();
}

fn main() {
    // Load config to check debug flag
    let config = prism_lib::config::PrismConfig::load().unwrap_or_default();
    init_logger(config.debug);
    
    info!("Starting Prism v{}", env!("CARGO_PKG_VERSION"));
    debug!("Debug logging enabled");
    
    prism_lib::run()
}
