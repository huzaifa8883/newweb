import express from 'express';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import cors from 'cors';
import { SMTPClient } from 'emailjs';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer'
import fetch from "node-fetch"
dotenv.config();
const app = express();
 // Fallback to 9000 if PORT is not defined
const port = process.env.Port||8080
// Middleware to parse JSON bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const transporter = nodemailer.createTransport({
  service: 'Gmail', // Use your email provider
  auth: {
    user: 'hadershalihuzaifa@gmail.com',
    pass: 'xvqb abnp dxbc vsef',
  },
});

// Enable CORS for a specific origin


app.use(cors());
// Connect to MongoDB
mongoose.connect('mongodb+srv://website:huzaifa56567@cluster0.neu99.mongodb.net', {

}).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});
const dataschema = new mongoose.Schema({
  vinnumber:String,
  email:String
})
const Data = mongoose.model('Data',dataschema)
app.post('/submit-data',async(req,res)=>{
  const {vinnumber,email} = req.body;
  const newdata = new Data({
    vinnumber,
    email
  })
  newdata.save().then((data)=>{
    res.json({message:"Data saved"})
  }).catch((err)=>{
    console.error('Error saving data:', err);
    res.status(500).json({ message: 'Failed to save data' });
  })
})
app.get("/get-data",async(req,res)=>{
  const data = await Data.find()
  res.json({data})

})
// Create a Schema for Order Data
const orderSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  vinNumber: String,
  vehicleName: String,
  email: String,
  country: String,
  state: String,
  town: String,
  products: Array,
  totalPrice: Number,
  paymentStatus: String,
}, { timestamps: true });

// Create a model for Order
const Order = mongoose.model('Order', orderSchema);
const client = new SMTPClient({
  user: process.env.EMAIL_USER,
  password: process.env.EMAIL_PASS,
  host: 'smtp.gmail.com', // Use the appropriate SMTP host
  ssl: true,
});
// Route for handling checkout data submission
app.post('/submit-checkout', (req, res) => {
  const {
      firstName,
      lastName,
      vinNumber,
      vehicleName,
      email,
      country,
      state,
      town,
      products,
      paymentStatus,
  } = req.body;

  // Validate the incoming data
  if (!products || !Array.isArray(products) || products.length === 0) {
      return res
          .status(400)
          .json({ message: 'Products array is required and should not be empty.' });
  }

  // Check for payment status and ensure it's valid
  const orderPaymentStatus =
      paymentStatus === 'completed' ? 'Completed' : 'Pending';

  // Create a new order document
  const newOrder = new Order({
      firstName,
      lastName,
      vinNumber,
      vehicleName,
      email,
      country,
      state,
      town,
      products,
      paymentStatus: orderPaymentStatus,
  });

  // Save the order to the database
  newOrder
      .save()
      .then((order) => {
          // Prepare email details
          const productDetails = products
              .map(
                  (product) =>
                      `<p><strong>${product.packageName}</strong>: $${product.packagePrice} x ${product.quantity}</p>`
              )
              .join('');
          const totalPrice = products.reduce(
              (total, product) =>
                  total + product.packagePrice * product.quantity,
              0
          );

          const emailMessage = {
              from: process.env.EMAIL_USER,  // Sender's email (configured in environment variables)
              to: [email, process.env.EMAIL_USER],  // Send to both customer and admin
              subject: 'Thank You for Your Order!',
              text: `Thank you for your order!\n\nOrder Details:\n${products
                  .map(
                      (product) =>
                          `${product.packageName}: $${product.packagePrice} x ${product.quantity}`
                  )
                  .join('\n')}\n\nTotal Price: $${totalPrice.toFixed(2)}\nPayment Method: PayPal`,
              html: `
                  <h2>Thank you for your order!</h2>
                  <p>Order Details:</p>
                  ${productDetails}
                  <p><strong>Total Price: $${totalPrice.toFixed(2)}</strong></p>
                  <p><strong>Payment Method: PayPal</strong></p>
              `,
          };

          // Create a transporter using SMTP settings
          const transporter = nodemailer.createTransport({
              service: 'gmail',  // Or your email service (e.g., 'hotmail', 'yahoo', etc.)
              auth: {
                  user: process.env.EMAIL_USER,  // Email address for sending the email
                  pass: process.env.EMAIL_PASSWORD,  // Email password or App Password
              },
          });

          // Send the email using Nodemailer
          transporter.sendMail(emailMessage, (err, info) => {
              if (err) {
                  console.error('Error sending email:', err);
              } else {
                  console.log('Email sent successfully:', info.response);
              }
          });

          // Respond with success message
          res.json({
              message: 'Checkout successful and email sent!',
              orderDetails: order,
          });
      })
      .catch((err) => {
          console.error('Error saving order:', err);
          res.status(500).json({ message: 'Failed to save order' });
      });
});

// Route for fetching all orders
app.get('/orders', async (req, res) => {
  try {
    const orders = await Order.find();  // Fetch all orders from MongoDB
    res.json({ orders });  // Return orders as JSON response
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
});

app.get('/orders/:orderId', (req, res) => {
  const orderId = req.params.orderId;
  const order = Order.find(order => order._id === orderId); // Find order by orderId

  if (order) {
      res.json({ order });
  } else {
      res.status(404).send({ message: 'Order not found' });
  }
});

app.get('/get-order-status/:orderId', (req, res) => {
  const orderId = req.params.orderId;

  // Retrieve the order from your database (this is just a mockup)
  const order = Order[orderId];

  if (order) {
    res.json({ paymentStatus: order.paymentStatus });
  } else {
    res.status(404).json({ error: 'Order not found' });
  }
});

// Route to update the payment status of an order
app.post('/update-order-status', async (req, res) => {
  const { orderId, paymentStatus } = req.body;

  // Validate that we have the necessary data
  if (!orderId || !paymentStatus) {
    return res.status(400).json({ message: 'Order ID and payment status are required.' });
  }

  // Ensure that the payment status is either 'completed' or 'pending'
  if (!['completed', 'pending'].includes(paymentStatus.toLowerCase())) {
    return res.status(400).json({ message: 'Invalid payment status.' });
  }

  try {
    // Find the order by ID
    const order = await Order.findById(orderId);
    

    // If the payment status is updated to 'completed', send an email
    if (paymentStatus.toLowerCase() === 'completed') {
      // Prepare email details
      const productDetails = order.products
        .map(
          (product) =>
            `<p><strong>${product.packageName}</strong>: $${product.packagePrice} x ${product.quantity}</p>`
        )
        .join('');
      const totalPrice = order.products.reduce(
        (total, product) => total + product.packagePrice * product.quantity,
        0
      );

      const emailMessage = {
        text: `Thank you for your order!\n\nOrder Details:\n${order.products
          .map(
            (product) =>
              `${product.packageName}: $${product.packagePrice} x ${product.quantity}`
          )
          .join('\n')}\n\nTotal Price: $${totalPrice.toFixed(
          2
        )}\nPayment Method: PayPal`,
        from: process.env.EMAIL_USER,
        to: order.email,
        subject: 'Payment Completed: Thank You for Your Order!',
        attachment: [
          {
            data: `
                <h2>Thank you for your order!</h2>
                <p>Order Details:</p>
                ${productDetails}
                <p><strong>Total Price: $${totalPrice.toFixed(
                  2
                )}</strong></p>
                <p><strong>Payment Method: PayPal</strong></p>
            `,
            alternative: true,
          },
        ],
      };

      // Send the email using emailjs
      client.send(emailMessage, (err, message) => {
        if (err) {
          console.error('Error sending email:', err);
        } else {
          console.log('Email sent successfully:', message);
        }
      });
    }

    // Update the payment status
    order.paymentStatus = paymentStatus;

    // Save the updated order
    await order.save();

    res.json({
      message: `Order status updated to ${paymentStatus}`,
      orderDetails: order,
    });
  } catch (err) {
    console.error('Error updating order status:', err);
    res.status(500).json({ message: 'Failed to update order status' });
  }
});

app.get('/', (req, res) => {
  res.json({ message: 'Server is running!' });
});
// Route to update the payment status of an order to "completed"
app.post('/complete-order', async (req, res) => {
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ message: 'Order ID is required' });
  }

  try {
    // Find the order by ID
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Update the payment status to "completed"
    order.paymentStatus = 'completed';

    // Save the updated order
    await order.save();

    // Prepare email details
    const productDetails = order.products
      .map(
        (product) =>
          `<p><strong>${product.packageName}</strong>: $${product.packagePrice} x ${product.quantity}</p>`
      )
      .join('');
    const totalPrice = order.products.reduce(
      (total, product) => total + product.packagePrice * product.quantity,
      0
    );

    // Email message details
    const emailMessage = {
      from: process.env.EMAIL_USER,  // Sender's email (configured in environment variables)
      to: [process.env.EMAIL_USER],  // Send to admin (you can customize this to send to the customer)
      subject: `Order Completed: ${orderId}`,
      text: `Order ID: ${orderId}\n\nOrder Details:\n${order.products
        .map(
          (product) =>
            `${product.packageName}: $${product.packagePrice} x ${product.quantity}`
        )
        .join('\n')}\n\nTotal Price: $${totalPrice.toFixed(2)}\nPayment Method: PayPal`,
      html: `
        <h2>Order Completed</h2>
        <p><strong>Order ID:</strong> ${orderId}</p>
        <p>Order Details:</p>
        ${productDetails}
        <p><strong>Total Price: $${totalPrice.toFixed(2)}</strong></p>
        <p><strong>Payment Method: PayPal</strong></p>
      `,
    };

    // Create a transporter using SMTP settings
    const transporter = nodemailer.createTransport({
      service: 'gmail',  // Or another email service (e.g., 'hotmail', 'yahoo', etc.)
      auth: {
        user: process.env.EMAIL_USER,  // Email address for sending the email
        pass: process.env.EMAIL_PASSWORD,  // Email password or App Password
      },
    });

    // Send the email using Nodemailer
    transporter.sendMail(emailMessage, (err, info) => {
      if (err) {
        console.error('Error sending email:', err);
      } else {
        console.log('Email sent successfully:', info.response);
      }
    });

    // Respond with success message
    res.json({ message: 'Order completed and email sent', orderDetails: order });
  } catch (err) {
    console.error('Error updating order status:', err);
    res.status(500).json({ message: 'Failed to update order status' });
  }
});
app.post('/payment-notification', async (req, res) => {
  const { txn_id, paymentStatus, totalPrice, orderId } = req.body;

  // Ensure required fields are present
  if (!txn_id || !orderId || !totalPrice || !paymentStatus) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    // Verify PayPal IPN (you can implement this function as needed)
    const verification = await verifyPayPalNotification(req.body);
    if (!verification) {
      return res.status(400).json({ message: 'Invalid payment notification' });
    }

    // Find the order in the database
    const order = await Order.findOne({ _id: orderId });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if the payment status is already completed
    if (order.paymentStatus === 'completed') {
      console.log('Payment already completed for this order:', orderId);
      return res.status(200).json({ message: 'Payment already completed', order });
    }

    // If paymentStatus is 'pending', we update it to 'completed'
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: orderId },
      {
        paymentStatus: 'completed', // Set paymentStatus to 'completed'
        paymentDetails: {
          transactionId: txn_id,
          totalPaid: totalPrice,
          paymentMethod: 'PayPal',
        },
      },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({ message: 'Order not found after update' });
    }

    console.log('Order payment status updated:', updatedOrder);

    // Send confirmation email
   

    const mailOptions = {
      from: 'hadershalihuzaifa@gmail.com',  // Replace with your email
      to: order.email||"hadershalihuzaifa@gmail.com",       // Email of the customer from the order
      subject: 'Payment Confirmation',
      text: `Dear ${order.customerName},\n\nYour payment of $${totalPrice} for order #${orderId} has been successfully completed. Your order status is now "Completed".\n\nThank you for your purchase!\n\nBest regards,\nYour Company Name`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log('Error sending email:', error);
      } else {
        console.log('Email sent:', info.response);
      }
    });

    return res.status(200).json({ message: 'Payment status updated successfully', order: updatedOrder });
  } catch (err) {
    console.error('Error handling payment notification:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});



// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
