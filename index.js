const { MongoClient, ServerApiVersion } = require('mongodb')
const express = require('express')
const cors = require('cors')
const SSLCommerzPayment = require('sslcommerz')
require('dotenv').config()
const { v4: uuidv4 } = require('uuid')

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const port = process.env.PORT || 5000

// Demo Env files if necessary:-------------------------------

// STORE_ID=<get your storeId>
// STORE_PASSWORD=<get your store password>

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.oq9xl.mongodb.net/?retryWrites=true&w=majority`
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
})

async function run() {
  try {
    await client.connect()
    const database = client.db('Sslcommerz')
    const OrderCollection = database.collection('Booked')

    // Initialize payment
    app.post('/init', async (req, res) => {
      const ProductInfo = {
        total_amount: req.body.total_amount,
        currency: 'BDT',
        tran_id: uuidv4(),
        success_url: 'http://localhost:5000/success',
        fail_url: 'http://localhost:5000/fail',
        cancel_url: 'http://localhost:5000/cancel',
        ipn_url: 'http://localhost:5000/ipn',
        shipping_method: 'Courier',
        paymentStatus: 'pending',
        product_name: req.body.product_name,
        product_category: 'Electronic',
        product_profile: req.body.product_profile,
        product_image: req.body.product_image,
        cus_name: req.body.cus_name,
        cus_email: req.body.cus_email,
        cus_add1: 'Dhaka',
        cus_add2: 'Dhaka',
        cus_city: 'Dhaka',
        cus_state: 'Dhaka',
        cus_postcode: '1000',
        cus_country: 'Bangladesh',
        cus_phone: '01711111111',
        cus_fax: '01711111111',
        ship_name: 'Customer Name',
        ship_add1: 'Dhaka',
        ship_add2: 'Dhaka',
        ship_city: 'Dhaka',
        ship_state: 'Dhaka',
        ship_postcode: 1000,
        ship_country: 'Bangladesh',
        multi_card_name: 'mastercard',
        value_a: 'ref001_A',
        value_b: 'ref002_B',
        value_c: 'ref003_C',
        value_d: 'ref004_D',
      }

      // console.log(' my data ->', ProductInfo)

      // Insert order info
      const result = await OrderCollection.insertOne(ProductInfo)
      console.log(' result', result)

      if (result.acknowledged) {
        const sslcommer = new SSLCommerzPayment(
          process.env.STORE_ID,
          process.env.STORE_PASS,
          false,
        ) //true for live default false for sandbox
        sslcommer.init(ProductInfo).then((data) => {
          if (data.GatewayPageURL) {
            res.send(data.GatewayPageURL)
          } else {
            res
              .json({
                message: 'payment fail',
              })
              .status(400)
          }
        })
      } else {
        res.status(400)
      }
    })

    app.post('/success', async (req, res) => {
      const result = await OrderCollection.updateOne(
        { tran_id: req.body.tran_id },
        {
          $set: {
            val_id: req.body.val_id,
          },
        },
      )

      if (result.modifiedCount > 0) {
        res.redirect(`http://localhost:3000/success/${req.body.tran_id}`)
      }
    })

    app.post('/ipn', (req, res) => {
      console.log(req.body)
      res.send(req.body)
    })

    app.post('/cancel', async (req, res) => {
      const result = await OrderCollection.deleteOne({
        tran_id: req.body.tran_id,
      })

      if (result.deletedCount > 0) {
        res.status(200).redirect('http://localhost:3000/')
      }
    })

    app.post('/fail', async (req, res) => {
      const result = await OrderCollection.deleteOne({
        tran_id: req.body.tran_id,
      })

      if (result.deletedCount > 0) {
        res.status(400).redirect('http://localhost:3000/')
      }
    })

    app.post('/validate', async (req, res) => {
      const result = await OrderCollection.findOne({
        tran_id: req.body.tran_id,
      })

      if (result.val_id === req.body.val_id) {
        const update = await OrderCollection.updateOne(
          { tran_id: req.body.tran_id },
          {
            $set: {
              paymentStatus: 'paymentComplete',
            },
          },
        )
        console.log(update)
        res.send(update.modifiedCount > 0)
      } else {
        res.send('Chor detected')
      }
    })

    app.get('/orders/:tran_id', async (req, res) => {
      const id = req.params.tran_id
      const result = await OrderCollection.findOne({ tran_id: id })
      res.json(result)
    })
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close()
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send(' your app is running ')
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
