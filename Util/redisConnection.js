const redis = require('redis');
const config = require("../config.json")

const redisConnect = () => {
    const client = redis.createClient({
        url: `redis://${config.redis.host}:${config.redis.port}`,
        password: config.redis.password
    })

    client.on('connect', () => {
        console.log('Redis connected')
    })

    client.on('error', (err) => {
        console.log('Redis error', err)
    })

    client.connect()

    return client
}

module.exports = redisConnect