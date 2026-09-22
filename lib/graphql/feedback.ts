import { gql } from "@apollo/client";

export type FeedbackRating = "LIKE" | "DISLIKE";

export const FEEDBACK_CATEGORIES = [
  { value: "not_accurate", label: "Not accurate" },
  { value: "not_helpful", label: "Not helpful" },
  { value: "incomplete", label: "Incomplete" },
  { value: "didnt_follow_instructions", label: "Didn't follow instructions" },
  { value: "unsafe_or_offensive", label: "Unsafe or offensive" },
  { value: "other", label: "Other" },
] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]["value"];

export interface MessageFeedback {
  rating: FeedbackRating;
  categories: FeedbackCategory[];
  reason: string | null;
}

export const SET_MESSAGE_FEEDBACK = gql`
  mutation SetMessageFeedback(
    $messageId: ID!
    $rating: FeedbackRating
    $categories: [FeedbackCategory!]
    $reason: String
  ) {
    setMessageFeedback(messageId: $messageId, rating: $rating, categories: $categories, reason: $reason) {
      id
      feedback {
        rating
        categories
        reason
      }
    }
  }
`;
