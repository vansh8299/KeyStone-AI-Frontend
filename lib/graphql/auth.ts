import { gql } from "@apollo/client";

export const SIGNUP = gql`
  mutation Signup($input: SignupInput!) {
    signup(input: $input) {
      email
    }
  }
`;

export const VERIFY_EMAIL = gql`
  mutation VerifyEmail($input: VerifyEmailInput!) {
    verifyEmail(input: $input) {
      user {
        id
        email
        name
      }
    }
  }
`;

export const RESEND_VERIFICATION_CODE = gql`
  mutation ResendVerificationCode($email: String!) {
    resendVerificationCode(email: $email)
  }
`;

export const REQUEST_PASSWORD_RESET = gql`
  mutation RequestPasswordReset($email: String!) {
    requestPasswordReset(email: $email)
  }
`;

export const RESET_PASSWORD = gql`
  mutation ResetPassword($input: ResetPasswordInput!) {
    resetPassword(input: $input)
  }
`;

export const LOGIN = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      user {
        id
        email
        name
      }
    }
  }
`;

export const LOGOUT = gql`
  mutation Logout {
    logout
  }
`;

/** Conversations the sidebar loads at a time; "Show more" fetches the next page. */
export const CONVERSATION_PAGE_SIZE = 30;

// The page size is written into the query (not a variable) so every read of ME — useQuery,
// readQuery, refetchQueries — addresses the same cached field.
export const ME = gql`
  query Me {
    me {
      id
      email
      name
      conversations(first: ${CONVERSATION_PAGE_SIZE}) {
        id
        title
        updatedAt
      }
    }
  }
`;

export const MORE_CONVERSATIONS = gql`
  query MoreConversations($after: ID!) {
    me {
      id
      conversations(first: ${CONVERSATION_PAGE_SIZE}, after: $after) {
        id
        title
        updatedAt
      }
    }
  }
`;