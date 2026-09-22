import { gql } from "@apollo/client";

export const SIGNUP = gql`
  mutation Signup($input: SignupInput!) {
    signup(input: $input) {
      user {
        id
        email
        name
      }
    }
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

export const ME = gql`
  query Me {
    me {
      id
      email
      name
      conversations {
        id
        title
        updatedAt
      }
    }
  }
`;