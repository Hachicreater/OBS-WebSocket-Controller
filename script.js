let socket;
let authenticated = false;

// WebSocketに接続
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
                authenticate(challenge, salt, password);
            }

            if (message.op === 2) {
                authenticated = true;
                updateStatus("authStatus", "認証済み");
                addLog("認証成功");
            }

            if (message.op === 3) {
                authenticated = false;
                updateStatus("authStatus", "認証失敗");
                addLog(`認証失敗: ${message.d.reason}`);
            }
        };
    });
}

// ボタン動作を設定
document.getElementById("connect").addEventListener("click", async () => {
    try {
        await connectToOBS();
    } catch (error) {
        console.error("Connection error:", error);
    }
});
