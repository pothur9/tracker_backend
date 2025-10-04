const https = require('https')

function getJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            const json = JSON.parse(data)
            resolve(json)
          } catch (e) {
            reject(e)
          }
        })
      })
      .on('error', (err) => reject(err))
  })
}

exports.getDrivingRoute = async (req, res, next) => {
  try {
    const { originLat, originLng, destLat, destLng } = req.query
    if (
      typeof originLat === 'undefined' ||
      typeof originLng === 'undefined' ||
      typeof destLat === 'undefined' ||
      typeof destLng === 'undefined'
    ) {
      return res.status(400).json({ error: 'Missing origin/destination parameters' })
    }

    const key = process.env.GOOGLE_DIRECTIONS_API_KEY || process.env.GOOGLE_MAPS_API_KEY
    if (!key) {
      return res.status(500).json({ error: 'Server missing GOOGLE_DIRECTIONS_API_KEY/GOOGLE_MAPS_API_KEY' })
    }

    const origin = `${encodeURIComponent(originLat)},${encodeURIComponent(originLng)}`
    const destination = `${encodeURIComponent(destLat)},${encodeURIComponent(destLng)}`
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=driving&key=${key}`

    const result = await getJson(url)
    if (result.status !== 'OK' || !Array.isArray(result.routes) || !result.routes[0]) {
      return res.status(502).json({ error: 'Directions API failed', status: result.status, details: result.error_message || null })
    }

    const route = result.routes[0]
    const polyline = route.overview_polyline?.points || null
    const bounds = route.bounds || null

    return res.json({ polyline, bounds })
  } catch (err) {
    next(err)
  }
}
