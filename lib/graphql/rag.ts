import { gql } from "@apollo/client";

export const INGEST_FILE = gql`
  mutation IngestFile($file: Upload!, $sourceUrl: String) {
    ingestFile(file: $file, sourceUrl: $sourceUrl) {
      document {
        id
        title
        createdAt
      }
      chunkCount
      pipeline
    }
  }
`;

export const INGEST_TEXT = gql`
  mutation IngestText($input: IngestTextInput!) {
    ingestText(input: $input) {
      document {
        id
        title
        createdAt
      }
      chunkCount
      pipeline
    }
  }
`;

export const DELETE_INGESTED_DOCUMENT = gql`
  mutation DeleteIngestedDocument($documentId: ID!) {
    deleteIngestedDocument(documentId: $documentId)
  }
`;

export const DOCUMENTS = gql`
  query Documents {
    documents {
      id
      title
      sourceUrl
      contentHash
      createdAt
    }
  }
`;

export const ASK_AGENT = gql`
  mutation AskAgent($question: String!, $conversationId: ID) {
    askAgent(question: $question, conversationId: $conversationId) {
      answer
      toolsUsed
      conversationId
      needsHumanInput
    }
  }
`;

export const ASK_AGENT_STREAM = gql`
  subscription AskAgentStream(
    $question: String
    $conversationId: ID
    $editMessageId: ID
    $regenerateMessageId: ID
    $attachmentIds: [ID!]
  ) {
    askAgentStream(
      question: $question
      conversationId: $conversationId
      editMessageId: $editMessageId
      regenerateMessageId: $regenerateMessageId
      attachmentIds: $attachmentIds
    ) {
      type
      conversationId
      text
      status
      result {
        answer
        toolsUsed
        conversationId
        needsHumanInput
        userMessageId
        assistantMessageId
      }
    }
  }
`;

export const CONVERSATION_TURN = gql`
  subscription ConversationTurn($conversationId: ID!) {
    conversationTurn(conversationId: $conversationId) {
      type
      conversationId
      text
      status
      result {
        answer
        toolsUsed
        conversationId
        needsHumanInput
        userMessageId
        assistantMessageId
      }
    }
  }
`;

export const UPLOAD_CHAT_FILE = gql`
  mutation UploadChatFile($file: Upload!) {
    uploadChatFile(file: $file) {
      id
      kind
      filename
      mimeType
      parsedText
      summary
      pageCount
    }
  }
`;

export const SEARCH_DOCUMENTS = gql`
  query SearchDocuments($query: String!, $topK: Int) {
    searchDocuments(query: $query, topK: $topK) {
      documentId
      title
      text
      score
    }
  }
`;
