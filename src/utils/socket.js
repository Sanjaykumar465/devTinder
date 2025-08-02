const { Server } = require("socket.io");
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const Message = require('../models/message');

const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "http://localhost:5173",
      credentials: true,
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "Authorization", "token"]
    },
  });

  // Authentication middleware for Socket.io
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.token;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, "DEV@tinder$3025");
      const user = await User.findById(decoded._id).select('-password');
      
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (err) {
      console.error('Socket authentication error:', err);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on("connection", (socket) => {
    console.log(`User ${socket.user.firstName} ${socket.user.lastName} connected: ${socket.id}`);

    // Join user to their personal room for direct messaging
    socket.join(`user_${socket.userId}`);

    // Update user online status
    User.findByIdAndUpdate(socket.userId, {
      isOnline: true,
      lastSeen: new Date()
    }).catch(err => console.error('Error updating online status:', err));

    // Broadcast user online status to all connected users
    socket.broadcast.emit('userOnline', {
      userId: socket.userId,
      userInfo: {
        _id: socket.userId,
        firstName: socket.user.firstName,
        lastName: socket.user.lastName,
        photoUrl: socket.user.photoUrl
      }
    });

    // Handle joining specific chat rooms
    socket.on("joinChat", (targetUserId) => {
      if (!targetUserId) {
        console.log('No target user ID provided for joinChat');
        return;
      }

      // Create a unique room name for the conversation
      const roomName = [socket.userId, targetUserId].sort().join('_');
      socket.join(roomName);
      
      console.log(`User ${socket.userId} joined chat room: ${roomName}`);
      
      // Notify the target user that someone joined the chat
      socket.to(`user_${targetUserId}`).emit('userJoinedChat', {
        userId: socket.userId,
        userInfo: {
          _id: socket.userId,
          firstName: socket.user.firstName,
          lastName: socket.user.lastName,
          photoUrl: socket.user.photoUrl
        }
      });
    });

    // Handle leaving specific chat rooms
    socket.on("leaveChat", (targetUserId) => {
      if (!targetUserId) {
        console.log('No target user ID provided for leaveChat');
        return;
      }

      const roomName = [socket.userId, targetUserId].sort().join('_');
      socket.leave(roomName);
      
      console.log(`User ${socket.userId} left chat room: ${roomName}`);
      
      // Stop typing indicator when leaving chat
      socket.to(`user_${targetUserId}`).emit('userStoppedTyping', {
        userId: socket.userId
      });
    });

    // Handle direct message sending (for real-time delivery)
    socket.on("sendMessage", async (data) => {
      const { targetUserId, content } = data;
      
      if (!targetUserId || !content) {
        console.log('Invalid message data received');
        return;
      }

      try {
        // Save message to database
        const newMessage = new Message({
          senderId: socket.userId,
          receiverId: targetUserId,
          content: content.trim(),
          timestamp: new Date(),
          isRead: false
        });

        const savedMessage = await newMessage.save();
        await savedMessage.populate('senderId', 'firstName lastName photoUrl');
        await savedMessage.populate('receiverId', 'firstName lastName photoUrl');

        console.log(`Message from ${socket.userId} to ${targetUserId}:`, content);

        // Send message to target user in real-time
        socket.to(`user_${targetUserId}`).emit('newMessage', {
          message: savedMessage,
          from: socket.userId
        });

        // Send delivery confirmation to sender
        socket.emit('messageDelivered', {
          messageId: savedMessage._id,
          targetUserId: targetUserId,
          deliveredAt: new Date(),
          message: savedMessage
        });

      } catch (error) {
        console.error('Error saving message:', error);
        socket.emit('messageError', {
          error: 'Failed to send message',
          targetUserId
        });
      }
    });

    // Handle typing indicators
    socket.on("typing", (data) => {
      const { targetUserId, isTyping } = data;
      
      if (!targetUserId) {
        console.log('No target user ID provided for typing');
        return;
      }

      if (isTyping) {
        socket.to(`user_${targetUserId}`).emit('userTyping', {
          userId: socket.userId,
          userInfo: {
            firstName: socket.user.firstName,
            lastName: socket.user.lastName,
            photoUrl: socket.user.photoUrl
          }
        });
      } else {
        socket.to(`user_${targetUserId}`).emit('userStoppedTyping', {
          userId: socket.userId
        });
      }
    });

    // Handle message read receipts
    socket.on("markAsRead", async (data) => {
      const { targetUserId, messageIds } = data;
      
      if (!targetUserId) {
        console.log('No target user ID provided for markAsRead');
        return;
      }

      try {
        // Update messages as read in database
        if (messageIds && messageIds.length > 0) {
          await Message.updateMany(
            {
              _id: { $in: messageIds },
              receiverId: socket.userId,
              senderId: targetUserId,
              isRead: false
            },
            {
              isRead: true,
              readAt: new Date()
            }
          );
        }

        // Notify sender that messages were read
        socket.to(`user_${targetUserId}`).emit('messagesRead', {
          userId: socket.userId,
          messageIds: messageIds || [],
          readAt: new Date()
        });
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    });

    // Handle message reactions
    socket.on("messageReaction", async (data) => {
      const { targetUserId, messageId, reaction } = data;
      
      if (!targetUserId || !messageId) {
        console.log('Invalid reaction data received');
        return;
      }

      try {
        // Update message with reaction
        const message = await Message.findById(messageId);
        if (message) {
          // Remove existing reaction from this user
          message.reactions = message.reactions.filter(r => r.userId.toString() !== socket.userId);
          
          // Add new reaction if provided
          if (reaction) {
            message.reactions.push({
              userId: socket.userId,
              reaction,
              timestamp: new Date()
            });
          }
          
          await message.save();

          // Broadcast reaction to target user
          socket.to(`user_${targetUserId}`).emit('messageReaction', {
            messageId,
            reaction,
            userId: socket.userId,
            userInfo: {
              firstName: socket.user.firstName,
              lastName: socket.user.lastName,
              photoUrl: socket.user.photoUrl
            }
          });
        }
      } catch (error) {
        console.error('Error updating message reaction:', error);
      }
    });

    // Handle user presence updates
    socket.on("updatePresence", (data) => {
      const { status } = data;
      
      // Update user status in database
      User.findByIdAndUpdate(socket.userId, {
        status: status || 'online',
        lastSeen: new Date()
      }).catch(err => console.error('Error updating presence:', err));

      // Broadcast presence update
      socket.broadcast.emit('userPresenceUpdate', {
        userId: socket.userId,
        status: status || 'online',
        lastSeen: new Date()
      });
    });

    // Handle voice/video call initiation
    socket.on("initiateCall", (data) => {
      const { targetUserId, callType } = data;
      
      if (!targetUserId) {
        console.log('No target user ID provided for call initiation');
        return;
      }

      socket.to(`user_${targetUserId}`).emit('incomingCall', {
        from: socket.userId,
        fromUser: {
          _id: socket.userId,
          firstName: socket.user.firstName,
          lastName: socket.user.lastName,
          photoUrl: socket.user.photoUrl
        },
        callType,
        timestamp: new Date()
      });
    });

    // Handle call response
    socket.on("callResponse", (data) => {
      const { targetUserId, accepted, callType } = data;
      
      if (!targetUserId) {
        console.log('No target user ID provided for call response');
        return;
      }

      socket.to(`user_${targetUserId}`).emit('callResponse', {
        from: socket.userId,
        accepted,
        callType,
        timestamp: new Date()
      });
    });

    // Handle disconnect
    socket.on("disconnect", (reason) => {
      console.log(`User ${socket.user.firstName} ${socket.user.lastName} disconnected: ${socket.id}, Reason: ${reason}`);
      
      // Update user offline status
      User.findByIdAndUpdate(socket.userId, {
        isOnline: false,
        lastSeen: new Date()
      }).catch(err => console.error('Error updating offline status:', err));

      // Broadcast user offline status
      socket.broadcast.emit('userOffline', {
        userId: socket.userId,
        lastSeen: new Date()
      });

      // Clean up any remaining typing indicators
      socket.broadcast.emit('userStoppedTyping', {
        userId: socket.userId
      });
    });

    // Handle connection errors
    socket.on("error", (error) => {
      console.error(`Socket error for user ${socket.userId}:`, error);
    });

    // Handle ping/pong for connection health
    socket.on("ping", () => {
      socket.emit("pong", {
        timestamp: new Date(),
        userId: socket.userId
      });
    });
  });

  // Handle io-level errors
  io.engine.on("connection_error", (err) => {
    console.log('Socket.io connection error:', err.req);
    console.log('Error code:', err.code);
    console.log('Error message:', err.message);
    console.log('Error context:', err.context);
  });

  return io;
};

module.exports = initializeSocket;