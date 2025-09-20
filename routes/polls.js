const express = require('express');
const Poll = require('../models/Poll');
const Vote = require('../models/Vote');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Create a new poll
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { question, options, isPublic } = req.body;

    // Validation
    if (!question || !options || !Array.isArray(options) || options.length < 2 || options.length > 4) {
      return res.status(400).json({ error: 'Question and 2-4 options are required' });
    }

    if (options.some(option => !option.text || option.text.trim().length === 0)) {
      return res.status(400).json({ error: 'All options must have text' });
    }

    // Create poll
    const poll = new Poll({
      question,
      options: options.map(option => ({ text: option.text, votes: 0 })),
      createdBy: req.user._id,
      isPublic: isPublic !== undefined ? isPublic : true
    });

    await poll.save();

    res.status(201).json({
      message: 'Poll created successfully',
      poll: {
        id: poll._id,
        question: poll.question,
        options: poll.options,
        isPublic: poll.isPublic,
        createdAt: poll.createdAt
      }
    });
  } catch (error) {
    console.error('Create poll error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all polls created by the authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const polls = await Poll.find({ createdBy: req.user._id })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email');

    res.json({ polls });
  } catch (error) {
    console.error('Get polls error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific poll by ID
router.get('/:id', async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);

    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Check if user can access this poll
    if (!poll.isPublic && (!req.user || !req.user._id.equals(poll.createdBy))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get vote counts
    const votes = await Vote.aggregate([
      { $match: { pollId: poll._id } },
      { $group: { _id: '$optionIndex', count: { $sum: 1 } } }
    ]);

    // Update poll options with vote counts
    const pollWithVotes = poll.toObject();
    pollWithVotes.options = pollWithVotes.options.map((option, index) => ({
      ...option,
      votes: votes.find(v => v._id === index)?.count || 0
    }));

    // Calculate total votes
    pollWithVotes.totalVotes = votes.reduce((sum, v) => sum + v.count, 0);

    res.json({ poll: pollWithVotes });
  } catch (error) {
    console.error('Get poll error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
