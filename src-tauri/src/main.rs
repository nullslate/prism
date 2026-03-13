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
                log::Level::Error => record.level().to_string().red().bold(),
                log::Level::Warn => record.level().to_string().yellow().bold(),
                log::Level::Info => record.level().to_string().green().bold(),
                log::Level::Debug => record.level().to_string().cyan().bold(),
                log::Level::Trace => record.level().to_string().purple().bold(),
            };

            // Strip the crate prefix for cleaner output
            let target = record.target()
                .strip_prefix("prism_lib::")
                .or_else(|| record.target().strip_prefix("prism::"))
                .unwrap_or(record.target());

            if target == "prism_lib" || target == "prism" {
                writeln!(
                    buf,
                    "{} {} {}",
                    "[prism]".purple().bold(),
                    level_colored,
                    record.args()
                )
            } else {
                writeln!(
                    buf,
                    "{} {} {}: {}",
                    "[prism]".purple().bold(),
                    level_colored,
                    target.dimmed(),
                    record.args()
                )
            }
        })
        .init();
}

fn main() {
    // Force colored output even when piped (e.g. tauri dev)
    colored::control::set_override(true);

    // Load config to check debug flag
    let config = prism_lib::config::PrismConfig::load().unwrap_or_default();
    init_logger(config.debug);
    
    info!("Starting Prism v{}", env!("CARGO_PKG_VERSION"));
    debug!("Debug logging enabled");
    
    prism_lib::run()
}
