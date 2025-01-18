let socket;
let authenticated = false;

// 状態更新用関数
function updateStatus(id, status) {
    document.getElementById(id).textContent = status;
}

// 実行ログにメッセージを追加 (最新を上に表示)
function addLog(message) {
    const log = document.getElementById("log");
    const p = document.createElement("p");
    p.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    log.prepend(p); // 最新ログを一番上に追加
}

// パスワード表示切り替え
document.getElementById("togglePassword").addEventListener("change", (event) => {
    const passwordInput = document.getElementById("obsPassword");
    passwordInput.type = event.target.checked ? "text" : "password";
});

async function connectToOBS() {
    const OBS_HOST = document.getElementById("obsHost").value;
    const PASSWORD = document.getElementById("obsPassword").value;

    return new Promise((resolve, reject) => {
        socket = new WebSocket(OBS_HOST);

        updateStatus("connectionStatus", "接続中...");
        addLog("OBS WebSocketに接続を試みています...");

        socket.onopen = () => {
            console.log("Connected to OBS WebSocket");
            updateStatus("connectionStatus", "接続済み");
            addLog("WebSocket接続成功");
            resolve();
        };

        socket.onerror = (error) => {
            console.error("WebSocket Error:", error);
            updateStatus("connectionStatus", "接続エラー");
            addLog("WebSocket接続エラー: " + error.message);
            reject(error);
        };

        socket.onclose = (event) => {
            console.error(`WebSocket connection closed: Code ${event.code}, Reason: ${event.reason}`);
            updateStatus("connectionStatus", "未接続");
            updateStatus("authStatus", "未認証");
            authenticated = false;
            addLog(`WebSocket接続が閉じられました (コード: ${event.code}, 理由: ${event.reason})`);
        };

        socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            console.log("Received message:", message);

            if (message.op === 0) {
                const { challenge, salt } = message.d.authentication;
                authenticate(challenge, salt, PASSWORD);
            }

            if (message.op === 2) {
                console.log("Authentication successful!");
                authenticated = true;
                updateStatus("authStatus", "認証済み");
                addLog("認証に成功しました");
            }

            if (message.op === 3) {
                console.error("Authentication failed:", message.d.reason);
                updateStatus("authStatus", "認証失敗");
                addLog(`認証失敗: ${message.d.reason}`);
            }

            if (message.op === 5 && message.d.eventType === "ReplayBufferSaved") {
                addLog("リプレイバッファがセーブされました");
                alert("リプレイバッファがセーブされました");
            }

            if (message.op === 5 && message.d.eventType === "RecordStateChanged") {
                const state = message.d.eventData.outputActive;
                updateStatus("recordingStatus", state ? "録画中" : "停止中");

                const startButton = document.getElementById("startRecording");
                startButton.textContent = state ? "録画中" : "開始";
                startButton.className = state ? "active" : "default";
            }

            if (message.op === 5 && message.d.eventType === "ReplayBufferStateChanged") {
                const state = message.d.eventData.outputActive;
                updateStatus("replayBufferStatus", state ? "有効中" : "停止中");

                const startButton = document.getElementById("startReplayBuffer");
                startButton.textContent = state ? "有効中" : "開始";
                startButton.className = state ? "active" : "default";
            }
        };
    });
}

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
    addLog("認証メッセージを送信しました");
}

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

async function sendRequest(requestType) {
    if (!authenticated) {
        console.error("Cannot send request. Not authenticated.");
        addLog("リクエストを送信できません: 未認証");
        return;
    }

    const requestMessage = {
        op: 6,
        d: {
            requestType: requestType,
            requestId: String(Date.now()), // Unique ID
        },
    };

    console.log("Sending request:", requestMessage);
    socket.send(JSON.stringify(requestMessage));
    addLog(`リクエストを送信しました: ${requestType}`);
}

document.getElementById("connect").addEventListener("click", async () => {
    try {
        await connectToOBS();
    } catch (error) {
        console.error("Connection error:", error);
    }
});

document.getElementById("startRecording").addEventListener("click", async () => {
    await sendRequest("StartRecord");
});

document.getElementById("stopRecording").addEventListener("click", async () => {
    await sendRequest("StopRecord");
});

document.getElementById("startReplayBuffer").addEventListener("click", async () => {
    await sendRequest("StartReplayBuffer");
});

document.getElementById("stopReplayBuffer").addEventListener("click", async () => {
    await sendRequest("StopReplayBuffer");
});

document.getElementById("saveReplayBuffer").addEventListener("click", async () => {
    await sendRequest("SaveReplayBuffer");
});
