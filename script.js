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

    if (id === "recordingStatus") {
        statusElement.textContent = status;
    }

    if (id === "replayBufferStatus") {
        statusElement.textContent = status;
    }

    if (id === "streamStatus") {
        statusElement.textContent = status;
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
            console.log("Connected to OBS WebSocket");
            updateStatus("connectionStatus", "接続済み");
            addLog("WebSocket接続成功");
            resolve();
        };

        socket.onerror = (error) => {
            console.error("WebSocket Error:", error);
            updateStatus("connectionStatus", "未接続");
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

            if (message.d?.requestType === "GetSceneList" && message.d.requestStatus.result) {
                const scenes = message.d.responseData.scenes;
                populateSceneDropdown(scenes);
            }
        };
    });
}

// 認証
async function authenticate(challenge, salt, password) {
    const authHash = await generateAuthHash(password, challenge, salt);

    const authMessage = {
        op: 1, // Identify operation
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

    // Step 1: パスワード + salt のSHA-256ハッシュを計算
    const passwordSaltHash = await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(password + salt)
    );

    // Step 2: 上記の結果とchallengeを結合し、再度SHA-256ハッシュを計算
    const passwordSaltHashBase64 = btoa(
        String.fromCharCode(...new Uint8Array(passwordSaltHash))
    );
    const finalHash = await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(passwordSaltHashBase64 + challenge)
    );

    // Step 3: Base64エンコード
    return btoa(String.fromCharCode(...new Uint8Array(finalHash)));
}

// シーンリストを取得
function getSceneList() {
    if (!authenticated) {
        addLog("シーンリストを取得できません: 未認証");
        return;
    }

    const requestMessage = {
        op: 6,
        d: {
            requestType: "GetSceneList",
            requestId: String(Date.now()),
        },
    };

    socket.send(JSON.stringify(requestMessage));
    addLog("シーンリストをリクエストしました");
}

// シーン切り替えドロップダウン更新
function populateSceneDropdown(scenes) {
    const sceneSelect = document.getElementById("sceneSelect");
    sceneSelect.innerHTML = "";

    scenes.forEach((scene) => {
        const option = document.createElement("option");
        option.value = scene.sceneName;
        option.textContent = scene.sceneName;
        sceneSelect.appendChild(option);
    });

    addLog("シーンリストを更新しました");
}

// シーンを切り替え
function switchScene() {
    if (!authenticated) {
        addLog("シーンを切り替えられません: 未認証");
        return;
    }

    const selectedScene = document.getElementById("sceneSelect").value;
    const requestMessage = {
        op: 6,
        d: {
            requestType: "SetCurrentProgramScene",
            requestId: String(Date.now()),
            requestData: {
                sceneName: selectedScene,
            },
        },
    };

    socket.send(JSON.stringify(requestMessage));
    addLog(`シーンを切り替えリクエスト送信: ${selectedScene}`);
}

// イベントリスナー
document.getElementById("connect").addEventListener("click", connectToOBS);
document.getElementById("switchScene").addEventListener("click", switchScene);
