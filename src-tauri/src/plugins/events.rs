use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub type EventHandler = Box<dyn Fn(&EventPayload) -> Option<String> + Send>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventPayload {
    pub event: String,
    #[serde(default)]
    pub path: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub data: Option<serde_json::Value>,
}

pub struct EventBus {
    handlers: HashMap<String, Vec<(String, EventHandler)>>,
}

impl EventBus {
    pub fn new() -> Self {
        Self {
            handlers: HashMap::new(),
        }
    }

    pub fn subscribe(&mut self, event: &str, plugin: &str, handler: EventHandler) {
        self.handlers
            .entry(event.to_string())
            .or_default()
            .push((plugin.to_string(), handler));
    }

    /// Dispatch an event. For file:pre-render, chains handlers and returns
    /// the final transformed content. For other events, returns None.
    pub fn dispatch(&self, payload: &EventPayload) -> Option<String> {
        let handlers = match self.handlers.get(&payload.event) {
            Some(h) => h,
            None => return None,
        };

        if payload.event == "file:pre-render" {
            let mut content = payload.content.clone();
            for (plugin_name, handler) in handlers {
                let mut p = payload.clone();
                p.content = content.clone();
                match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| handler(&p))) {
                    Ok(result) => {
                        if let Some(transformed) = result {
                            content = Some(transformed);
                        }
                    }
                    Err(_) => {
                        eprintln!("[prism] plugin '{}' panicked in file:pre-render", plugin_name);
                    }
                }
            }
            content
        } else {
            for (plugin_name, handler) in handlers {
                match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| handler(payload))) {
                    Ok(_) => {}
                    Err(_) => {
                        eprintln!("[prism] plugin '{}' panicked in {}", plugin_name, payload.event);
                    }
                }
            }
            None
        }
    }

    pub fn remove_plugin(&mut self, plugin: &str) {
        for handlers in self.handlers.values_mut() {
            handlers.retain(|(name, _)| name != plugin);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dispatch_no_handlers() {
        let bus = EventBus::new();
        let payload = EventPayload {
            event: "file:opened".into(),
            path: Some("/test.md".into()),
            name: Some("test.md".into()),
            content: None,
            kind: None,
            data: None,
        };
        assert!(bus.dispatch(&payload).is_none());
    }

    #[test]
    fn test_pre_render_chaining() {
        let mut bus = EventBus::new();

        bus.subscribe("file:pre-render", "plugin-a", Box::new(|p| {
            let c = p.content.as_deref().unwrap_or("");
            Some(format!("A({})", c))
        }));

        bus.subscribe("file:pre-render", "plugin-b", Box::new(|p| {
            let c = p.content.as_deref().unwrap_or("");
            Some(format!("B({})", c))
        }));

        let payload = EventPayload {
            event: "file:pre-render".into(),
            path: None,
            name: None,
            content: Some("hello".into()),
            kind: None,
            data: None,
        };

        let result = bus.dispatch(&payload);
        assert_eq!(result, Some("B(A(hello))".into()));
    }

    #[test]
    fn test_pre_render_nil_passthrough() {
        let mut bus = EventBus::new();

        bus.subscribe("file:pre-render", "plugin-a", Box::new(|_p| {
            None // pass through
        }));

        bus.subscribe("file:pre-render", "plugin-b", Box::new(|p| {
            let c = p.content.as_deref().unwrap_or("");
            Some(format!("B({})", c))
        }));

        let payload = EventPayload {
            event: "file:pre-render".into(),
            path: None,
            name: None,
            content: Some("hello".into()),
            kind: None,
            data: None,
        };

        let result = bus.dispatch(&payload);
        assert_eq!(result, Some("B(hello)".into()));
    }
}
