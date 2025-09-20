const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
  pollId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Poll',
    required: [true, 'Vote must be associated with a poll']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return !this.isGuest;
    }
  },
  optionIndex: {
    type: Number,
    required: [true, 'Option index is required'],
    min: [0, 'Option index must be 0 or greater']
  },
  name: {
    type: String,
    required: [true, 'Voter name is required'],
    trim: true,
    maxlength: [100, 'Voter name cannot exceed 100 characters']
  },
  isGuest: {
    type: Boolean,
    default: false
  },
  guestId: {
    type: String,
    required: function() {
      return this.isGuest;
    }
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate votes
voteSchema.index({ pollId: 1, userId: 1 }, { unique: true, sparse: true });
voteSchema.index({ pollId: 1, guestId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Vote', voteSchema);
