const express = require('express');
const Poll = require('../models/Poll');
const Vote = require('../models/Vote');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Submit a vote
router.post('/:id/vote', optionalAuth, async (req, res) => {

  try {
    const { optionIndex, name } = req.body;
    const pollId = req.params.id;

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

    // Check if user has already voted
    let existingVote = null;
    if (req.user) {
      existingVote = await Vote.findOne({ pollId, userId: req.user._id });
    } else {
      // For guest voting, we would need a guest identifier
      // For now, we'll allow one vote per session
      const guestId = req.headers['x-guest-id'] || req.ip;
      existingVote = await Vote.findOne({ pollId, guestId, isGuest: true });
    }

    if (existingVote) {
      return res.status(400).json({ error: 'You have already voted on this poll' });
    }

    // Create vote record
    const voteData = {
      pollId,
      userId: req.user ? req.user._id : null,
      optionIndex,
      isGuest: !req.user,
      name: name.trim()
    };
    if (!req.user) {
      voteData.guestId = req.headers['x-guest-id'] || req.ip;
    }
    const vote = new Vote(voteData);

    try {
      await vote.save();
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({ error: 'You have already voted on this poll.' });
      }
      throw err;
    }

    // Update poll vote counts
    await Poll.findByIdAndUpdate(pollId, {
      $inc: { 'options.$[elem].votes': 1, totalVotes: 1 },
      $push: { voters: { userId: req.user ? req.user._id : null, optionIndex, name: name.trim() } }
    }, {
      arrayFilters: [{ 'elem': optionIndex }]
    });
// Get voter names for a poll
router.get('/:id/voters', async (req, res) => {
  try {
    const pollId = req.params.id;
    // Find the poll to get the owner
    const poll = await Poll.findById(pollId);
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }
    // If user is owner, block access
    if (req.user && req.user._id.equals(poll.createdBy)) {
      return res.status(403).json({ error: 'Owners cannot view poll results.' });
    }
    // Get all votes for this poll
    const votes = await Vote.find({ pollId }, 'name').lean();
    const voterNames = votes.map(v => v.name);
    res.json({ voters: voterNames });
  } catch (error) {
    console.error('Error fetching voters:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

    // Get updated poll data
    const updatedPoll = await Poll.findById(pollId);
    const votes = await Vote.aggregate([
      { $match: { pollId: poll._id } },
      { $group: { _id: '$optionIndex', count: { $sum: 1 } } }
    ]);

    const pollWithVotes = updatedPoll.toObject();
    pollWithVotes.options = pollWithVotes.options.map((option, index) => ({
      ...option,
      votes: votes.find(v => v._id === index)?.count || 0
    }));
    pollWithVotes.totalVotes = votes.reduce((sum, v) => sum + v.count, 0);

    // Emit real-time update via Socket.io
    const io = req.app.get('io');
    io.to(pollId).emit('poll-updated', { poll: pollWithVotes });

    res.json({
      message: 'Vote submitted successfully',
      poll: pollWithVotes
    });
  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
