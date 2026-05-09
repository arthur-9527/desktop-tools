const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:9876');

console.log('Connecting to ws://localhost:9876...');

ws.on('open', () => {
  console.log('✅ Connected to Agent Desk!');
  
  // 发送认证
  console.log('Sending authentication...');
  ws.send(JSON.stringify({ type: 'auth', password: 'admin123' }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('📨 Received:', JSON.stringify(msg, null, 2));
  
  // 根据消息类型响应
  switch (msg.type) {
    case 'auth_result':
      if (msg.success) {
        console.log('✅ Authentication successful!');
      } else {
        console.log('❌ Authentication failed!');
        ws.close();
      }
      break;
      
    case 'ready':
      console.log(`✅ Agent ready. Screen: ${msg.screenSize.width}x${msg.screenSize.height}, Platform: ${msg.platform}`);
      // 测试截图
      console.log('Requesting screenshot...');
      ws.send(JSON.stringify({ type: 'capture_frame', quality: 80 }));
      break;
      
    case 'frame':
      console.log(`✅ Screenshot received: ${msg.width}x${msg.height}, ${msg.data.length} bytes (base64)`);
      // 测试鼠标移动
      console.log('Testing mouse move...');
      ws.send(JSON.stringify({ type: 'mouse_move', x: 500, y: 500 }));
      break;
      
    case 'response':
      if (msg.code === 0) {
        console.log(`✅ Command ${msg.requestType} executed successfully`);
      } else {
        console.log(`❌ Command ${msg.requestType} failed: ${msg.msg}`);
      }
      
      // 测试完所有功能后关闭
      if (msg.requestType === 'mouse_move') {
        console.log('All tests passed! Closing connection...');
        setTimeout(() => ws.close(), 500);
      }
      break;
  }
});

ws.on('error', (err) => {
  console.log('❌ WebSocket error:', err.message);
});

ws.on('close', () => {
  console.log('Connection closed');
  process.exit(0);
});