const express = require('express');
const Poll = require('../models/Poll');
const Vote = require('../models/Vote');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Create a new poll
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { question, options, isPublic } = req.body;

    // Validation
    if (!question || !options || !Array.isArray(options) || options.length < 2 || options.length > 4) {
      return res.status(400).json({ error: 'Question and 2-4 options are required' });
    }

    if (options.some(option => !option || typeof option.text !== 'string' || option.text.trim().length === 0)) {
      return res.status(400).json({ error: 'Each option must be an object with a non-empty text property.' });
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
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);

    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Check if user can access this poll
    if (!poll.isPublic && (!req.user || !req.user._id.equals(poll.createdBy))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // The poll document already contains the vote counts.
    res.json({ poll });
  } catch (error) {
    console.error('Get poll error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
