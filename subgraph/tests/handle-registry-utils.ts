import { newMockEvent } from "matchstick-as"
import { ethereum, BigInt, Address } from "@graphprotocol/graph-ts"
import {
  HandleAdded,
  MemberCreated,
  OwnershipTransferred,
  PaymentSent
} from "../generated/HandleRegistry/HandleRegistry"

export function createHandleAddedEvent(
  memberId: BigInt,
  platform: string,
  username: string
): HandleAdded {
  let handleAddedEvent = changetype<HandleAdded>(newMockEvent())

  handleAddedEvent.parameters = new Array()

  handleAddedEvent.parameters.push(
    new ethereum.EventParam(
      "memberId",
      ethereum.Value.fromUnsignedBigInt(memberId)
    )
  )
  handleAddedEvent.parameters.push(
    new ethereum.EventParam("platform", ethereum.Value.fromString(platform))
  )
  handleAddedEvent.parameters.push(
    new ethereum.EventParam("username", ethereum.Value.fromString(username))
  )

  return handleAddedEvent
}

export function createMemberCreatedEvent(
  memberId: BigInt,
  wallet: Address
): MemberCreated {
  let memberCreatedEvent = changetype<MemberCreated>(newMockEvent())

  memberCreatedEvent.parameters = new Array()

  memberCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "memberId",
      ethereum.Value.fromUnsignedBigInt(memberId)
    )
  )
  memberCreatedEvent.parameters.push(
    new ethereum.EventParam("wallet", ethereum.Value.fromAddress(wallet))
  )

  return memberCreatedEvent
}

export function createOwnershipTransferredEvent(
  previousOwner: Address,
  newOwner: Address
): OwnershipTransferred {
  let ownershipTransferredEvent =
    changetype<OwnershipTransferred>(newMockEvent())

  ownershipTransferredEvent.parameters = new Array()

  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam(
      "previousOwner",
      ethereum.Value.fromAddress(previousOwner)
    )
  )
  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam("newOwner", ethereum.Value.fromAddress(newOwner))
  )

  return ownershipTransferredEvent
}

export function createPaymentSentEvent(
  platform: string,
  username: string,
  from: Address,
  amount: BigInt
): PaymentSent {
  let paymentSentEvent = changetype<PaymentSent>(newMockEvent())

  paymentSentEvent.parameters = new Array()

  paymentSentEvent.parameters.push(
    new ethereum.EventParam("platform", ethereum.Value.fromString(platform))
  )
  paymentSentEvent.parameters.push(
    new ethereum.EventParam("username", ethereum.Value.fromString(username))
  )
  paymentSentEvent.parameters.push(
    new ethereum.EventParam("from", ethereum.Value.fromAddress(from))
  )
  paymentSentEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )

  return paymentSentEvent
}
