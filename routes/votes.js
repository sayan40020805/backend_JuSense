const express = require('express');
const mongoose = require('mongoose');
const Poll = require('../models/Poll');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Submit a vote
router.post('/:id/vote', optionalAuth, async (req, res) => {
  try {
    const { optionIndex, name } = req.body;
    const pollId = req.params.id;

    // Validate Poll ID
    if (!mongoose.Types.ObjectId.isValid(pollId)) {
      return res.status(400).json({ error: 'Invalid poll ID' });
    }

    // Validation
    if (optionIndex === undefined || optionIndex === null) {
      return res.status(400).json({ error: 'Option index is required' });
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Voter name is required' });
    }

    // Find the poll
    const poll = await Poll.findById(pollId);
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Check if poll is accessible
    if (!poll.isPublic && (!req.user || !req.user._id.equals(poll.createdBy))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Prevent poll owner from voting
    if (req.user && req.user._id.equals(poll.createdBy)) {
      return res.status(403).json({ error: 'Owners cannot vote on their own poll.' });
    }

    // Check if option index is valid
    if (optionIndex < 0 || optionIndex >= poll.options.length) {
      return res.status(400).json({ error: 'Invalid option index' });
    }

    // Atomically update the poll, but only if the user hasn't voted yet.
    // This prevents race conditions and ensures data consistency.
    const findQuery = { _id: pollId };
    const voterData = {
      optionIndex,
      name: name.trim()
    };

    if (req.user) {
      voterData.userId = req.user._id;
      findQuery['voters.userId'] = { $ne: req.user._id };
    } else {
      const guestId = req.headers['x-guest-id'] || req.ip;
      voterData.guestId = guestId;
      findQuery['voters.guestId'] = { $ne: guestId };
    }

    const updateQuery = {
      $inc: {
        totalVotes: 1,
        [`options.${optionIndex}.votes`]: 1
      },
      $push: { voters: voterData }
    };

    const updatedPoll = await Poll.findOneAndUpdate(findQuery, updateQuery, { new: true }).lean();

    if (!updatedPoll) {
      // If the poll was not updated, it's because the user has already voted.
      // The `findQuery` would not have matched.
      return res.status(400).json({ error: 'You have already voted on this poll' });
    }

    // Emit real-time update via Socket.io
    const io = req.app.get('io');
    io.to(pollId).emit('poll-updated', { poll: updatedPoll });

    res.json({
      message: 'Vote submitted successfully',
      poll: updatedPoll
    });
  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get voter names for a poll (owner only)
router.get('/:id/voters', authenticateToken, async (req, res) => {
  try {
    const pollId = req.params.id;

    // Find the poll to get the owner
    const poll = await Poll.findById(pollId).lean();
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Only the poll owner can see the voter details.
    if (!poll.createdBy.equals(req.user._id)) {
      return res.status(403).json({ error: 'Access denied. Only the poll owner can view these details.' });
    }

    // The poll document already contains voter information. We can process it directly
    // without a second database query, which is more efficient and reliable.
    const voterDetails = poll.options.map((option, index) => ({
      option: option.text,
      count: option.votes || 0,
      voters: poll.voters.filter(voter => voter.optionIndex === index).map(voter => voter.name)
    }));

    res.json({ totalVotes: poll.totalVotes, voterDetails });
  } catch (error) {
    console.error('Error fetching voters:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
