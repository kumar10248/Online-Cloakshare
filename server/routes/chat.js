const express = require('express');
const router = express.Router();
const ChatRoom = require('../models/Chat');

// Get chat room info
router.get('/room/:roomId', async (req, res) => {
    try {
        const { roomId } = req.params;
        
        const chatRoom = await ChatRoom.findOne({ roomId });
        
        if (!chatRoom) {
            return res.status(404).json({
                success: false,
                message: 'Chat room not found'
            });
        }

        // Don't expose sensitive socket IDs
        const roomInfo = {
            roomId: chatRoom.roomId,
            hostName: chatRoom.hostName,
            guestName: chatRoom.guestName,
            status: chatRoom.status,
            createdAt: chatRoom.createdAt,
            messageCount: chatRoom.messages.length,
            isCallActive: chatRoom.callSession.isActive,
            callType: chatRoom.callSession.callType
        };

        res.json({
            success: true,
            room: roomInfo
        });

    } catch (error) {
        console.error('Error getting room info:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get room information'
        });
    }
});

// Get chat history (with pagination)
router.get('/room/:roomId/messages', async (req, res) => {
    try {
        const { roomId } = req.params;
        const { page = 1, limit = 50 } = req.query;
        
        const chatRoom = await ChatRoom.findOne({ roomId });
        
        if (!chatRoom) {
            return res.status(404).json({
                success: false,
                message: 'Chat room not found'
            });
        }

        // Get paginated messages
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        
        const messages = chatRoom.messages
            .slice(startIndex, endIndex)
            .map(msg => ({
                senderId: msg.senderId,
                senderName: msg.senderName,
                type: msg.type,
                content: msg.type === 'file' ? '[File]' : msg.content, // Don't send file data
                fileName: msg.fileName,
                fileSize: msg.fileSize,
                timestamp: msg.timestamp
            }));

        res.json({
            success: true,
            messages,
            pagination: {
                currentPage: parseInt(page),
                totalMessages: chatRoom.messages.length,
                hasMore: endIndex < chatRoom.messages.length
            }
        });

    } catch (error) {
        console.error('Error getting messages:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get messages'
        });
    }
});

// Check if room exists and is available
router.get('/room/:roomId/status', async (req, res) => {
    try {
        const { roomId } = req.params;
        
        const chatRoom = await ChatRoom.findOne({ roomId });
        
        if (!chatRoom) {
            return res.json({
                success: true,
                exists: false,
                available: false
            });
        }

        const available = chatRoom.status === 'waiting';
        
        res.json({
            success: true,
            exists: true,
            available,
            status: chatRoom.status,
            hostName: chatRoom.hostName,
            guestName: chatRoom.guestName
        });

    } catch (error) {
        console.error('Error checking room status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check room status'
        });
    }
});

// Get server statistics
router.get('/stats', async (req, res) => {
    try {
        const totalRooms = await ChatRoom.countDocuments();
        const activeRooms = await ChatRoom.countDocuments({ status: { $in: ['waiting', 'connected'] } });
        const connectedRooms = await ChatRoom.countDocuments({ status: 'connected' });
        
        res.json({
            success: true,
            stats: {
                totalRooms,
                activeRooms,
                connectedRooms,
                waitingRooms: activeRooms - connectedRooms
            }
        });

    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get statistics'
        });
    }
});

// Manual cleanup endpoint (admin use)
router.post('/cleanup', async (req, res) => {
    try {
        const result = await ChatRoom.cleanupInactiveRooms();
        
        res.json({
            success: true,
            message: `Cleaned up ${result.deletedCount} inactive rooms`
        });

    } catch (error) {
        console.error('Error in manual cleanup:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cleanup rooms'
        });
    }
});

// Health check
router.get('/health', (req, res) => {
    res.json({
        success: true,
        service: 'Chat Service',
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;