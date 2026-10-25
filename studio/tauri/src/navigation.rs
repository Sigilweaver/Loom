//! Navigation policy for the main window.
//!
//! The webview must only ever show the app itself. Anything else the renderer
//! tries to open (a link, `window.open`, a redirect) is either handed to the
//! system browser (http, https, mailto, tel) or refused, so remote content is
//! never loaded into a window that can call the app's commands.

use tauri::Url;

/// What to do with a URL the webview wants to load or open.
#[derive(Debug, PartialEq, Eq)]
pub enum UrlAction {
    /// The app's own content: load it in the webview.
    App,
    /// A link for the system browser or mail client.
    External,
    /// Anything else (file:, javascript:, custom schemes): refuse.
    Block,
}

/// Port of the Vite dev server (`devUrl` in tauri.conf.json).
const DEV_PORT: u16 = 25810;

/// Classify a URL. `dev` allows the Vite dev server as an app origin.
pub fn classify(url: &Url, dev: bool) -> UrlAction {
    match url.scheme() {
        // macOS and Linux serve the bundled app from tauri://localhost.
        "tauri" => UrlAction::App,
        "about" if url.as_str() == "about:blank" => UrlAction::App,
        "http" | "https" => {
            // Windows serves the bundled app from http(s)://tauri.localhost.
            let bundled = url.host_str() == Some("tauri.localhost");
            let dev_server =
                dev && url.host_str() == Some("localhost") && url.port() == Some(DEV_PORT);
            if bundled || dev_server {
                UrlAction::App
            } else {
                UrlAction::External
            }
        }
        "mailto" | "tel" => UrlAction::External,
        _ => UrlAction::Block,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn c(url: &str, dev: bool) -> UrlAction {
        classify(&Url::parse(url).unwrap(), dev)
    }

    #[test]
    fn bundled_app_origins_stay_in_the_webview() {
        assert_eq!(c("tauri://localhost/index.html", false), UrlAction::App);
        assert_eq!(c("http://tauri.localhost/", false), UrlAction::App);
        assert_eq!(c("https://tauri.localhost/x", false), UrlAction::App);
        assert_eq!(c("about:blank", false), UrlAction::App);
    }

    #[test]
    fn the_dev_server_is_an_app_origin_only_in_dev() {
        assert_eq!(c("http://localhost:25810/", true), UrlAction::App);
        assert_eq!(c("http://localhost:25810/", false), UrlAction::External);
        assert_eq!(c("http://localhost:9999/", true), UrlAction::External);
    }

    #[test]
    fn web_links_go_to_the_system_browser() {
        assert_eq!(
            c("https://sigilweaver.app/docs", false),
            UrlAction::External
        );
        assert_eq!(c("http://example.com/", false), UrlAction::External);
        assert_eq!(c("mailto:a@b.c", false), UrlAction::External);
        assert_eq!(c("tel:+15550100", false), UrlAction::External);
        // A look-alike host must not pass for the app.
        assert_eq!(
            c("https://tauri.localhost.evil.example/", false),
            UrlAction::External
        );
    }

    #[test]
    fn everything_else_is_blocked() {
        assert_eq!(c("file:///etc/passwd", false), UrlAction::Block);
        assert_eq!(c("javascript:alert(1)", false), UrlAction::Block);
        assert_eq!(c("ms-msdt:/id", false), UrlAction::Block);
        assert_eq!(c("about:srcdoc", false), UrlAction::Block);
    }
}
