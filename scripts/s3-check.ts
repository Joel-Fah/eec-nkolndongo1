/** Checks the object storage credentials in .env.local (never prints a secret): lists the buckets. */
import { AwsClient } from 'aws4fetch'
import { envLocal } from './env-local.ts'

const key = envLocal('AWS_ACCESS_KEY_ID')
const secret = envLocal('AWS_SECRET_ACCESS_KEY')
const endpoint = envLocal('AWS_ENDPOINT_URL_S3')
const region = envLocal('AWS_REGION') ?? 'auto'
if (!key || !secret || !endpoint) throw new Error('AWS_* variables missing in .env.local')
const aws = new AwsClient({ accessKeyId: key, secretAccessKey: secret, region, service: 's3' })
console.log('endpoint:', new URL(endpoint).host, '· region:', region)
const res = await aws.fetch(`${endpoint.replace(/\/$/, '')}/`)
console.log('GET / →', res.status)
const text = await res.text()
console.log(
  text
    .slice(0, 600)
    .replace(/<\/?[A-Za-z]*>/g, ' ')
    .replace(/\s+/g, ' '),
)
