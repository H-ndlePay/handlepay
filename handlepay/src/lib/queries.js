// src/lib/queries.js
import { gql } from "graphql-request";

export const MEMBERS = gql`
  query Members($first: Int = 50) {
    memberCreateds(first: $first, orderBy: blockTimestamp, orderDirection: desc) {
      memberId
      wallet
      blockTimestamp
    }
  }
`;

export const HANDLES_FOR_MEMBER = gql`
  query HandlesForMember($memberId: BigInt!) {
    handleAddeds(where: { memberId: $memberId }, orderBy: blockTimestamp, orderDirection: asc) {
      platform
      username
      blockTimestamp
    }
  }
`;
