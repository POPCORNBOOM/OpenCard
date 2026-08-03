const appId = process.env.QQ_BOT_APP_ID?.trim()
const clientSecret = process.env.QQ_BOT_CLIENT_SECRET?.trim()

if (!appId || !clientSecret) {
  console.error('请先设置 QQ_BOT_APP_ID 和 QQ_BOT_CLIENT_SECRET 环境变量。')
  process.exit(1)
}

const tokenResponse = await fetch('https://api.bot.qq.com/app/getAppAccessToken', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ appId, clientSecret }),
})
const tokenBody = await tokenResponse.text()
if (!tokenResponse.ok) {
  throw new Error(`获取 QQ AccessToken 失败 (${tokenResponse.status}): ${tokenBody}`)
}

const { access_token: accessToken } = JSON.parse(tokenBody)
if (!accessToken) throw new Error('QQ AccessToken 响应中没有 access_token。')

const gatewayResponse = await fetch('https://api.bot.qq.com/gateway', {
  headers: { Authorization: `QQBot ${accessToken}` },
})
const gatewayBody = await gatewayResponse.text()
if (!gatewayResponse.ok) {
  throw new Error(`获取 QQ 网关地址失败 (${gatewayResponse.status}): ${gatewayBody}`)
}

const { url } = JSON.parse(gatewayBody)
if (!url) throw new Error('QQ 网关响应中没有 WebSocket 地址。')

const socket = new WebSocket(url)
let heartbeatTimer
let latestSequence = null

const send = payload => socket.send(JSON.stringify(payload))

socket.addEventListener('message', event => {
  const payload = JSON.parse(event.data)
  if (payload.s != null) latestSequence = payload.s

  if (payload.op === 10) {
    send({
      op: 2,
      d: {
        token: `QQBot ${accessToken}`,
        intents: 1 << 25,
        shard: [0, 1],
        properties: {},
      },
    })

    heartbeatTimer = setInterval(() => {
      send({ op: 1, d: latestSequence })
    }, payload.d.heartbeat_interval)
    return
  }

  if (payload.op === 0 && payload.t === 'READY') {
    console.log('已连接。请在目标群里 @机器人 发送一条消息。')
    return
  }

  if (
    payload.op === 0 &&
    ['GROUP_ADD_ROBOT', 'GROUP_AT_MESSAGE_CREATE'].includes(payload.t) &&
    payload.d?.group_openid
  ) {
    console.log(`\nQQ_GROUP_OPENID=${payload.d.group_openid}`)
    clearInterval(heartbeatTimer)
    socket.close(1000)
  }

  if (payload.op === 9) {
    throw new Error(`QQ 网关鉴权失败: ${JSON.stringify(payload.d)}`)
  }
})

socket.addEventListener('error', () => {
  clearInterval(heartbeatTimer)
  console.error('QQ WebSocket 连接失败。')
  process.exitCode = 1
})

socket.addEventListener('close', event => {
  clearInterval(heartbeatTimer)
  if (event.code !== 1000) {
    console.error(`QQ WebSocket 已断开 (${event.code}): ${event.reason || '无原因信息'}`)
    process.exitCode = 1
  }
})
