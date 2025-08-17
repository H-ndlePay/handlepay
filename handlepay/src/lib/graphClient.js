// src/lib/graphClient.js
import { GraphQLClient } from "graphql-request";

export const graphClient = new GraphQLClient(
  "https://api.studio.thegraph.com/query/118793/handlepay-registry-base/v0.0.1"
);
