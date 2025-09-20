const mongoose = require('mongoose');
const Vote = require('./models/Vote');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/quickpolls';
console.log('Connecting to:', uri);

mongoose.connect(uri)
  .then(async () => {
    const result = await Vote.deleteMany({ guestId: null });
    console.log('Deleted votes with guestId: null:', result.deletedCount);
    const stillExists = await Vote.find({ guestId: null });
    console.log('Votes with guestId: null remaining:', stillExists.length);
    mongoose.disconnect();
  })
  .catch(err => {
    console.error('Error:', err);
    mongoose.disconnect();
  });
