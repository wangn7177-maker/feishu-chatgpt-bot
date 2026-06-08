const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // 处理飞书回调验证
  if (req.method === 'POST' && req.body.challenge) {
    return res.status(200).json({ challenge: req.body.challenge });
  }

  const { APPID, SECRET, KEY } = process.env;
  const event = req.body.event;

  if (!event || event.message_type !== 'text') {
    return res.status(200).json({ code: 0 });
  }

  // 提取用户消息
  const userText = event.content.replace(/<at.*?>/g, '').trim();
  if (!userText) return res.status(200).json({ code: 0 });

  try {
    // 调用 ChatGPT
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: userText }]
      })
    });

    const openaiData = await openaiRes.json();
    const replyText = openaiData.choices?.[0]?.message?.content || '抱歉，暂时无法回答。';

    // 获取飞书 Token
    const tokenRes = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: APPID, app_secret: SECRET })
    });
    const tokenData = await tokenRes.json();
    const tenantToken = tokenData.tenant_access_token;

    // 回复飞书
    await fetch(`https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=${event.receive_id_type}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tenantToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        receive_id: event.receive_id,
        content: JSON.stringify({ text: replyText }),
        msg_type: 'text'
      })
    });

    return res.status(200).json({ code: 0, msg: 'success' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ code: -1, msg: 'error' });
  }
};
