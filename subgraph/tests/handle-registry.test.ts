import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { BigInt, Address } from "@graphprotocol/graph-ts"
import { HandleAdded } from "../generated/schema"
import { HandleAdded as HandleAddedEvent } from "../generated/HandleRegistry/HandleRegistry"
import { handleHandleAdded } from "../src/handle-registry"
import { createHandleAddedEvent } from "./handle-registry-utils"

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#tests-structure

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let memberId = BigInt.fromI32(234)
    let platform = "Example string value"
    let username = "Example string value"
    let newHandleAddedEvent = createHandleAddedEvent(
      memberId,
      platform,
      username
    )
    handleHandleAdded(newHandleAddedEvent)
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#write-a-unit-test

  test("HandleAdded created and stored", () => {
    assert.entityCount("HandleAdded", 1)

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      "HandleAdded",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "memberId",
      "234"
    )
    assert.fieldEquals(
      "HandleAdded",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "platform",
      "Example string value"
    )
    assert.fieldEquals(
      "HandleAdded",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "username",
      "Example string value"
    )

    // More assert options:
    // https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#asserts
  })
})
