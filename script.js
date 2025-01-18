let socket;
let authenticated = false;

// 状態更新関数
function updateStatus(id, status) {
    const statusElement = document.getElementById(id);

    if (id === "connectionStatus") {
        if (status === "未接続") {
            statusElement.textContent = `❌ ${status}`;
            statusElement.style.color = "red";
        } else if (status === "接続中...") {
            statusElement.textContent = `🔄 ${status}`;
            statusElement.style.color = "orange";
        } else if (status === "接続済み") {
            statusElement.textContent = `✅ ${status}`;
            statusElement.style.color = "green";
        }
    }

    if (id === "authStatus") {
        if (status === "未認証") {
            statusElement.textContent = `❌ ${status}`;
            statusElement.style.color = "red";
        } else if (status === "認証済み") {
            statusElement.textContent = `✅ ${status}`;
            statusElement.style.color = "green";
        }
    }
}

// 実行ログの追加
function addLog(message) {
    const log = document.getElementById("log");
    const logEntry = document.createElement("p");
    logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    log.prepend(logEntry);
}

// WebSocket接続
async function connectToOBS() {
    const ip = document.getElementById("obsHost").value.trim();
    const password = document.getElementById("obsPassword").value.trim();

    if (!ip) {
        alert("IPアドレスを入力してください");
        return;
    }

    const OBS_HOST = `ws://${ip}:4455`;

    return new Promise((resolve, reject) => {
        socket = new WebSocket(OBS_HOST);

        updateStatus("connectionStatus", "接続中...");
        addLog(`OBS WebSocketに接続を試みています (${OBS_HOST})`);

        socket.onopen = () => {
            updateStatus("connectionStatus", "接続済み");
            addLog("WebSocket接続成功");
            resolve();
        };

        socket.onerror = (error) => {
            updateStatus("connectionStatus", "未接続");
            addLog("WebSocket接続エラー: " + error.message);
            reject(error);
        };

        socket.onclose = (event) => {
            updateStatus("connectionStatus", "未接続");
            updateStatus("authStatus", "未認証");
            authenticated = false;
            addLog(`WebSocket接続が閉じられました (コード: ${event.code}, 理由: ${event.reason})`);
        };

        socket.onmessage = (event) => {
            const message = JSON.parse(event.data);

            if (message.op === 0) {
                const { challenge, salt } = message.d.authentication;
                authenticate(challenge, salt, password);
            }

            if (message.op === 2) {
                authenticated = true;
                updateStatus("authStatus", "認証済み");
                addLog("認証成功");
            }

            if (message.op === 3) {
                authenticated = false;
                updateStatus("authStatus", "未認証");
                addLog(`認証失敗: ${message.d.reason}`);
            }
        };
    });
}

// 認証
async function authenticate(challenge, salt, password) {
    const authHash = await generateAuthHash(password, challenge, salt);

    const authMessage = {
        op: 1,
        d: {
            rpcVersion: 1,
            authentication: authHash,
        },
    };
    socket.send(JSON.stringify(authMessage));
}

// 認証用ハッシュ生成
async function generateAuthHash(password, challenge, salt) {
    const encoder = new TextEncoder();
    const passwordSaltHash = await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(password + salt)
    );
    const passwordSaltHashBase64 = btoa(
        String.fromCharCode(...new Uint8Array(passwordSaltHash))
    );
    const finalHash = await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(passwordSaltHashBase64 + challenge)
    );
    return btoa(String.fromCharCode(...new Uint8Array(finalHash)));
}

// パスワード表示/非表示の切り替え
document.getElementById("togglePassword").addEventListener("change", (e) => {
    const passwordInput = document.getElementById("obsPassword");
    passwordInput.type = e.target.checked ? "text" : "password";
});

// イベントリスナー
document.getElementById("connect").addEventListener("click", connectToOBS);
