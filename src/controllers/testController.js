const { sendToTokens } = require('../services/push')

async function testNotification(req, res) {
  try {
    const { fcmToken, title, body } = req.body
    
    if (!fcmToken) {
      return res.status(400).json({ error: 'fcmToken is required' })
    }

    const notificationTitle = title || 'Test Notification'
    const notificationBody = body || 'This is a test notification from the backend'

    const result = await sendToTokens({
      title: notificationTitle,
      body: notificationBody,
      data: {
        event: 'test_notification',
        timestamp: new Date().toISOString(),
      },
      tokens: [fcmToken],
    })

    return res.json({
      ok: true,
      message: 'Notification sent',
      result: {
        success: result?.success || 0,
        failure: result?.failure || 0,
        invalidTokens: result?.invalidTokens || [],
      },
    })
  } catch (e) {
    console.error('[testNotification] Error:', e)
    return res.status(500).json({ error: 'Failed to send test notification' })
  }
}

module.exports = { testNotification }
