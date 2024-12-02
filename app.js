const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');  // Import the cors package
const app = express();
const port = process.env.Port;

// Middleware to parse JSON bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Enable CORS for a specific origin
app.use(cors()); 

// Connect to MongoDB
mongoose.connect('mongodb+srv://website:huzaifa56567@cluster0.neu99.mongodb.net', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

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

// Route for handling checkout data submission
app.post('/submit-checkout', (req, res) => {
  const { firstName, lastName, vinNumber, vehicleName, email, country, state, town, products, paymentStatus } = req.body;

  // Validate the incoming data
  if (!products || !Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ message: 'Products array is required and should not be empty.' });
  }

  // Check for payment status and ensure it's valid
  const orderPaymentStatus = paymentStatus === 'completed' ? 'Completed' : 'Pending';

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
    paymentStatus: orderPaymentStatus
  });

  // Save the order to the database
  newOrder.save()
    .then(order => {
      res.json({
        message: 'Checkout successful!',
        orderDetails: order
      });
    })
    .catch(err => {
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
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    // Update the payment status
    order.paymentStatus = paymentStatus;

    // Save the updated order
    await order.save();

    res.json({
      message: `Order status updated to ${paymentStatus}`,
      orderDetails: order
    });
  } catch (err) {
    console.error('Error updating order status:', err);
    res.status(500).json({ message: 'Failed to update order status' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
