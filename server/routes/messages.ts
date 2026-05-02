import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated, requireAdmin } from "../jwtAuth";
import { users } from "@shared/schema";
import { emailService } from "../emailService";
import { getUserId } from "./_shared";

export async function registerMessagesRoutes(app: Express) {
  // Get user's messages (broadcasts they received)
  app.get('/api/messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const recipients = await storage.getUserBroadcastRecipients(userId);
      
      // Get user's own replies for each broadcast
      const messagesWithReplies = await Promise.all(
        recipients.map(async (recipient) => {
          const allReplies = await storage.getBroadcastRepliesByBroadcastId(recipient.broadcastId);
          const userReplies = allReplies.filter(r => r.userId === userId);
          return {
            ...recipient,
            userReplies,
          };
        })
      );
      
      res.json(messagesWithReplies);
    } catch (error) {
      console.error("Error getting user messages:", error);
      res.status(500).json({ message: "Failed to get messages" });
    }
  });

  // Get unread message count for user
  app.get('/api/messages/unread-count', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const count = await storage.getUnreadBroadcastCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error getting unread count:", error);
      res.status(500).json({ message: "Failed to get unread count" });
    }
  });

  // Mark a message as read
  app.post('/api/messages/:broadcastId/read', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { broadcastId } = req.params;
      await storage.markBroadcastAsRead(broadcastId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking message as read:", error);
      res.status(500).json({ message: "Failed to mark message as read" });
    }
  });

  // Reply to a broadcast message
  app.post('/api/messages/:broadcastId/reply', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { broadcastId } = req.params;
      const { content } = req.body;

      if (!content || !content.trim()) {
        return res.status(400).json({ message: "Reply content is required" });
      }

      const reply = await storage.createBroadcastReply({
        broadcastId,
        userId,
        content: content.trim(),
      });

      res.json(reply);
    } catch (error) {
      console.error("Error creating reply:", error);
      res.status(500).json({ message: "Failed to send reply" });
    }
  });

  // ============================================================
  // DIRECT MESSAGING SYSTEM - Two-way conversations between admin and users
  // ============================================================

  // Get user's direct conversations
  app.get('/api/messages/direct', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      
      let conversations;
      if (user?.isAdmin) {
        conversations = await storage.getDirectConversationsForAdmin();
      } else {
        conversations = await storage.getDirectConversationsForUser(userId);
      }
      
      // Enrich with user info and last message
      const enrichedConversations = await Promise.all(
        conversations.map(async (conv) => {
          const targetUser = await storage.getUser(conv.userId);
          const messages = await storage.getDirectMessages(conv.id);
          const lastMessage = messages[messages.length - 1];
          const readStatus = await storage.getDirectConversationReadStatus(conv.id, userId);
          const lastReadAt = readStatus?.lastReadAt || new Date(0);
          
          // Count unread messages for this conversation
          const unreadCount = messages.filter(m => {
            const isFromOther = user?.isAdmin ? !m.isFromAdmin : m.isFromAdmin;
            return isFromOther && m.createdAt && new Date(m.createdAt) > lastReadAt;
          }).length;
          
          return {
            ...conv,
            user: targetUser ? {
              id: targetUser.id,
              email: targetUser.email,
              firstName: targetUser.firstName,
              lastName: targetUser.lastName,
            } : null,
            lastMessage: lastMessage ? {
              content: lastMessage.content.substring(0, 100) + (lastMessage.content.length > 100 ? '...' : ''),
              createdAt: lastMessage.createdAt,
              isFromAdmin: lastMessage.isFromAdmin,
            } : null,
            unreadCount,
          };
        })
      );
      
      res.json(enrichedConversations);
    } catch (error) {
      console.error("Error getting direct conversations:", error);
      res.status(500).json({ message: "Failed to get conversations" });
    }
  });

  // Get unread direct message count
  app.get('/api/messages/direct/unread-count', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      const count = await storage.getUnreadDirectMessageCount(userId, user?.isAdmin || false);
      res.json({ count });
    } catch (error) {
      console.error("Error getting unread direct message count:", error);
      res.status(500).json({ message: "Failed to get unread count" });
    }
  });

  // Get messages in a conversation
  app.get('/api/messages/direct/:conversationId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      const { conversationId } = req.params;
      
      const conversation = await storage.getDirectConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      // Check access: user must be the target user or an admin
      if (!user?.isAdmin && conversation.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const messages = await storage.getDirectMessages(conversationId);
      const targetUser = await storage.getUser(conversation.userId);
      
      res.json({
        conversation: {
          ...conversation,
          user: targetUser ? {
            id: targetUser.id,
            email: targetUser.email,
            firstName: targetUser.firstName,
            lastName: targetUser.lastName,
          } : null,
        },
        messages,
      });
    } catch (error) {
      console.error("Error getting conversation messages:", error);
      res.status(500).json({ message: "Failed to get messages" });
    }
  });

  // Create a new direct conversation (admin only)
  app.post('/api/messages/direct', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const adminId = getUserId(req);
      const { userId, subject, initialMessage } = req.body;
      
      if (!userId || !subject || !initialMessage) {
        return res.status(400).json({ message: "User ID, subject, and initial message are required" });
      }
      
      if (initialMessage.length > 5000) {
        return res.status(400).json({ message: "Message content exceeds 5000 character limit" });
      }
      
      // Check target user exists
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Create conversation
      const conversation = await storage.createDirectConversation({
        subject: subject.trim(),
        userId,
        createdByAdminId: adminId,
      });
      
      // Create initial message
      await storage.createDirectMessage({
        conversationId: conversation.id,
        senderId: adminId,
        content: initialMessage.trim(),
        isFromAdmin: true,
      });
      
      // Send email notification to user
      emailService.sendDirectMessageNotification(
        { email: targetUser.email, firstName: targetUser.firstName || undefined, lastName: targetUser.lastName || undefined },
        subject.trim(),
        initialMessage.trim()
      ).catch(err => console.error("Failed to send direct message email:", err));
      
      res.json(conversation);
    } catch (error) {
      console.error("Error creating direct conversation:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  // Reply to a direct conversation
  app.post('/api/messages/direct/:conversationId/reply', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      const { conversationId } = req.params;
      const { content } = req.body;
      
      if (!content || !content.trim()) {
        return res.status(400).json({ message: "Message content is required" });
      }
      
      if (content.length > 5000) {
        return res.status(400).json({ message: "Message content exceeds 5000 character limit" });
      }
      
      const conversation = await storage.getDirectConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      // Check access
      if (!user?.isAdmin && conversation.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const message = await storage.createDirectMessage({
        conversationId,
        senderId: userId,
        content: content.trim(),
        isFromAdmin: user?.isAdmin || false,
      });
      
      // If admin is replying, send email notification to user
      if (user?.isAdmin) {
        const targetUser = await storage.getUser(conversation.userId);
        if (targetUser) {
          emailService.sendDirectMessageNotification(
            { email: targetUser.email, firstName: targetUser.firstName || undefined, lastName: targetUser.lastName || undefined },
            conversation.subject,
            content.trim()
          ).catch(err => console.error("Failed to send direct message reply email:", err));
        }
      }
      
      res.json(message);
    } catch (error) {
      console.error("Error sending direct message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Mark a direct conversation as read
  app.post('/api/messages/direct/:conversationId/read', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      const { conversationId } = req.params;
      
      const conversation = await storage.getDirectConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      // Check access
      if (!user?.isAdmin && conversation.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.upsertDirectConversationReadStatus(conversationId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking conversation as read:", error);
      res.status(500).json({ message: "Failed to mark as read" });
    }
  });

  // Archive a direct conversation (admin only)
  app.post('/api/messages/direct/:conversationId/archive', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { conversationId } = req.params;
      
      const conversation = await storage.getDirectConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      
      await storage.archiveDirectConversation(conversationId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error archiving conversation:", error);
      res.status(500).json({ message: "Failed to archive conversation" });
    }
  });

  // Get all users for admin to start conversations with
  app.get('/api/admin/users-for-messaging', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      // Return minimal user info for selection
      const usersForMessaging = allUsers
        .filter(u => !u.isAdmin) // Don't show admins
        .map(u => ({
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          preferredState: u.preferredState,
        }));
      res.json(usersForMessaging);
    } catch (error) {
      console.error("Error getting users for messaging:", error);
      res.status(500).json({ message: "Failed to get users" });
    }
  });
}
