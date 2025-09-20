const mongoose = require('mongoose');
const Vote = require('./models/Vote');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/quickpolls')
  .then(async () => {
    const result = await Vote.deleteMany({ guestId: null });
    console.log('Deleted votes:', result.deletedCount);
    mongoose.disconnect();
  })
  .catch(err => {
    console.error('Error:', err);
    mongoose.disconnect();
  });
