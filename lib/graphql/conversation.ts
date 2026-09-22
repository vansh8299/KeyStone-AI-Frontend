import { gql } from "@apollo/client";

export const CONVERSATION = gql`
  query Conversation($id: ID!) {
    conversation(id: $id) {
      id
      title
      activeLeafId
      isRewound
      messages {
        id
        parentId
        siblingIds
        role
        content
        source
        metadata
        feedback {
          rating
          categories
          reason
        }
        createdAt
      }
    }
  }
`;

export const SWITCH_BRANCH = gql`
  mutation SwitchBranch($conversationId: ID!, $messageId: ID!) {
    switchBranch(conversationId: $conversationId, messageId: $messageId) {
      id
      title
      activeLeafId
      isRewound
      messages {
        id
        parentId
        siblingIds
        role
        content
        source
        metadata
        feedback {
          rating
          categories
          reason
        }
        createdAt
      }
    }
  }
`;

export const REWIND_CONVERSATION = gql`
  mutation RewindConversation($conversationId: ID!, $messageId: ID!) {
    rewindConversation(conversationId: $conversationId, messageId: $messageId) {
      id
      title
      activeLeafId
      isRewound
      messages {
        id
        parentId
        siblingIds
        role
        content
        source
        metadata
        feedback {
          rating
          categories
          reason
        }
        createdAt
      }
    }
  }
`;

export const DELETE_CONVERSATION = gql`
  mutation DeleteConversation($id: ID!) {
    deleteConversation(id: $id)
  }
`;

export const GENERATE_CONVERSATION_TITLE = gql`
  mutation GenerateConversationTitle($id: ID!) {
    generateConversationTitle(id: $id) {
      id
      title
    }
  }
`;
