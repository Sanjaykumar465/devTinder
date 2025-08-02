const express = require('express');
const router = express.Router();
const { userAuth } = require('../middlewares/auth'); // Updated import
const Message = require('../models/message'); // You'll need to create this model
const User = require('../models/user');

// Get chat messages between current user and target user
router.get('/chat/:targetUserId', userAuth, async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const currentUserId = req.user._id;

    // Validate target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'Target user not found'
      });
    }

    // Fetch messages between the two users
    const messages = await Message.find({
      $or: [
        { senderId: currentUserId, receiverId: targetUserId },
        { senderId: targetUserId, receiverId: currentUserId }
      ]
    })
    .populate('senderId', 'firstName lastName photoUrl')
    .populate('receiverId', 'firstName lastName photoUrl')
    .sort({ timestamp: 1 });

    res.json({
      success: true,
      data: messages
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch messages'
    });
  }
});

// Send a new message
router.post('/chat/send', userAuth, async (req, res) => {
  try {
    const { targetUserId, content } = req.body;
    const currentUserId = req.user._id;

    if (!targetUserId || !content) {
      return res.status(400).json({
        success: false,
        error: 'Target user ID and content are required'
      });
    }

    // Validate target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'Target user not found'
      });
    }

    // Create new message
    const newMessage = new Message({
      senderId: currentUserId,
      receiverId: targetUserId,
      content: content.trim(),
      timestamp: new Date(),
      isRead: false
    });

    const savedMessage = await newMessage.save();
    
    // Populate sender info
    await savedMessage.populate('senderId', 'firstName lastName photoUrl');
    await savedMessage.populate('receiverId', 'firstName lastName photoUrl');

    // Emit to socket if available
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${targetUserId}`).emit('newMessage', {
        message: savedMessage,
        from: currentUserId
      });
    }

    res.json({
      success: true,
      data: savedMessage
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message'
    });
  }
});

// Mark messages as read
router.post('/chat/mark-read', userAuth, async (req, res) => {
  try {
    const { messageIds } = req.body;
    const currentUserId = req.user._id;

    if (!messageIds || !Array.isArray(messageIds)) {
      return res.status(400).json({
        success: false,
        error: 'Message IDs array is required'
      });
    }

    // Update messages as read
    await Message.updateMany(
      {
        _id: { $in: messageIds },
        receiverId: currentUserId,
        isRead: false
      },
      {
        isRead: true,
        readAt: new Date()
      }
    );

    res.json({
      success: true,
      message: 'Messages marked as read'
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark messages as read'
    });
  }
});

module.exports = router;