use notify::{Watcher, RecursiveMode, Event, EventKind};
use std::sync::Mutex;
use tauri::{State, Emitter};

// 存储 watcher 的全局状态
struct WatcherState {
    watcher: Mutex<Option<notify::RecommendedWatcher>>,
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn watch_directory(path: String, app_handle: tauri::AppHandle, state: State<WatcherState>) -> Result<String, String> {
    // 停止之前的监听
    let mut watcher_lock = state.watcher.lock().unwrap();
    *watcher_lock = None;

    // 创建新的 watcher
    let (tx, rx) = std::sync::mpsc::channel::<Result<Event, notify::Error>>();

    let mut watcher = notify::recommended_watcher(tx)
        .map_err(|e| format!("创建监听器失败: {}", e))?;

    watcher.watch(std::path::Path::new(&path), RecursiveMode::Recursive)
        .map_err(|e| format!("监听目录失败: {}", e))?;

    // 在新线程中处理文件变化事件
    let app_handle_clone = app_handle.clone();
    std::thread::spawn(move || {
        for res in rx {
            match res {
                Ok(event) => {
                    // 过滤掉一些不重要的事件
                    match event.kind {
                        EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_) => {
                            let paths: Vec<String> = event.paths.iter()
                                .map(|p| p.to_string_lossy().to_string())
                                .collect();

                            let payload = serde_json::json!({
                                "kind": format!("{:?}", event.kind),
                                "paths": paths
                            });

                            // 发送事件到前端
                            if let Err(e) = app_handle_clone.emit("file-changed", payload) {
                                eprintln!("发送事件失败: {}", e);
                            }
                        }
                        _ => {} // 忽略其他事件
                    }
                }
                Err(e) => eprintln!("监听错误: {}", e),
            }
        }
    });

    // 保存 watcher（防止被 drop）
    *watcher_lock = Some(watcher);

    Ok(format!("开始监听: {}", path))
}

#[tauri::command]
fn stop_watching(state: State<WatcherState>) -> Result<String, String> {
    let mut watcher_lock = state.watcher.lock().unwrap();
    *watcher_lock = None;
    Ok("停止监听".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(WatcherState {
            watcher: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![greet, watch_directory, stop_watching])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
