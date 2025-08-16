import {
  HandleAdded as HandleAddedEvent,
  MemberCreated as MemberCreatedEvent,
  OwnershipTransferred as OwnershipTransferredEvent,
  PaymentSent as PaymentSentEvent
} from "../generated/HandleRegistry/HandleRegistry"
import {
  HandleAdded,
  MemberCreated,
  OwnershipTransferred,
  PaymentSent
} from "../generated/schema"

export function handleHandleAdded(event: HandleAddedEvent): void {
  let entity = new HandleAdded(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.memberId = event.params.memberId
  entity.platform = event.params.platform
  entity.username = event.params.username

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleMemberCreated(event: MemberCreatedEvent): void {
  let entity = new MemberCreated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.memberId = event.params.memberId
  entity.wallet = event.params.wallet

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleOwnershipTransferred(
  event: OwnershipTransferredEvent
): void {
  let entity = new OwnershipTransferred(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.previousOwner = event.params.previousOwner
  entity.newOwner = event.params.newOwner

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handlePaymentSent(event: PaymentSentEvent): void {
  let entity = new PaymentSent(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )
  entity.platform = event.params.platform
  entity.username = event.params.username
  entity.from = event.params.from
  entity.amount = event.params.amount

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}
