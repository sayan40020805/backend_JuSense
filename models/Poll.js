const mongoose = require('mongoose');

const pollSchema = new mongoose.Schema({
  question: {
    type: String,
    required: [true, 'Question is required'],
    trim: true,
    maxlength: [200, 'Question cannot exceed 200 characters']
  },
  options: [{
    text: {
      type: String,
      required: [true, 'Option text is required'],
      trim: true,
      maxlength: [100, 'Option text cannot exceed 100 characters']
    },
    votes: {
      type: Number,
      default: 0
    }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Poll must have a creator']
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  totalVotes: {
    type: Number,
    default: 0
  },
  voters: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    guestId: {
      type: String
    },
    optionIndex: {
      type: Number,
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    votedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Index for efficient queries
pollSchema.index({ createdBy: 1, createdAt: -1 });
pollSchema.index({ isPublic: 1, createdAt: -1 });

module.exports = mongoose.model('Poll', pollSchema);
