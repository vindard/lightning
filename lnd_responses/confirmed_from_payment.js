const {attemptStates} = require('./constants');
const rpcAttemptHtlcAsAttempt = require('./rpc_attempt_htlc_as_attempt');
const {safeTokens} = require('./../bolt00');

const {isArray} = Array;
const is256Hex = n => !!n && /^[0-9A-F]{64}$/i.test(n);
const {max} = Math;
const mtokensAsTokens = mtokens => safeTokens({mtokens}).tokens;

/** Calculate total payment details from RPC payment HTLC elements

  The `route` attribute only returns the first route, there may be more due to
  payment splitting

  {
    creation_date: <Creation Date Epoch Time Seconds String>
    creation_time_ns: <Creation Date Epoch Time Nanoseconds String>
    failure_reason: <Payment Failure Reason String>
    fee_msat: <Fee Paid in Millitokens String>
    fee_sat: <Fee Paid in Tokens String>
    htlcs: [{
      attempt_time_ns: <HTLC Sent At Epoch Time Nanoseconds String>
      resolve_time_ns: <HTLC Resolved At Epoch Time Nanoseconds String>
      route: {
        hops: [{
          amt_to_forward: <Tokens to Forward String>
          amt_to_forward_msat: <Millitokens to Forward String>
          chan_id: <Numeric Format Channel Id String>
          chan_capacity: <Channel Capacity Tokens String>
          expiry: <Timeout Chain Height Number>
          fee: <Fee in Tokens String>
          fee_msat: <Fee in Millitokens String>
          [mpp_record]: {
            payment_addr: <Payment Identifier Buffer>
            total_amt_msat: <Total Payment Millitokens Amount String>
          }
          [pub_key]: <Next Hop Public Key Hex String>
          tlv_payload: <Has Extra TLV Data Bool>
        }]
        total_amt: <Total Tokens String>
        total_amt_msat: <Route Total Millitokens String>
        total_fees: <Route Fee Tokens String>
        total_fees_msat: <Route Total Fees Millitokens String>
        total_time_lock: <Route Total Timelock Number>
      }
      status: <HTLC Status String>
    }]
    path: [<Hop Public Key Hex String>]
    payment_hash: <Preimage SHA256 Hash Hex String>
    payment_index: <Payment Index String>
    payment_preimage: <Payment Secret Preimage Hex String>
    payment_request: <BOLT 11 Payment Request String>
    status: <Payment State String>
    value: <Tokens String>
    value_msat: <Paid Tokens Without Routing Fees Millitokens String>
    value_sat: <Paid Tokens Without Routing Fees String>
  }

  @throws
  <Error>

  @returns
  {
    fee: <Total Fee Tokens Paid Rounded Down Number>
    fee_mtokens: <Total Fee Millitokens Paid String>
    hops: [{
      channel: <First Path Standard Format Channel Id String>
      channel_capacity: <First Path Channel Capacity Tokens Number>
      fee: <First Route Fee Path Rounded Down Number>
      fee_mtokens: <First Path Fee Millitokens String>
      forward: <First Path Forward Tokens Number>
      forward_mtokens: <First Path Forward Millitokens String>
      public_key: <First Path Public Key Hex String>
      timeout: <First Path Timeout Block Height Number>
    }]
    id: <Payment Hash Hex String>
    mtokens: <Total Millitokens Paid String>
    paths: [{
      fee: <Total Fee Tokens Paid Number>
      fee_mtokens: <Total Fee Millitokens Paid String>
      hops: [{
        channel: <Standard Format Channel Id String>
        channel_capacity: <Channel Capacity Tokens Number>
        fee: <Fee Tokens Rounded Down Number>
        fee_mtokens: <Fee Millitokens String>
        forward: <Forward Tokens Number>
        forward_mtokens: <Forward Millitokens String>
        public_key: <Public Key Hex String>
        timeout: <Timeout Block Height Number>
      }]
      mtokens: <Total Millitokens Paid String>
      safe_fee: <Total Fee Tokens Paid Rounded Up Number>
      safe_tokens: <Total Tokens Paid, Rounded Up Number>
      timeout: <Expiration Block Height Number>
    }]
    safe_fee: <Total Fee Tokens Paid Rounded Up Number>
    safe_tokens: <Total Tokens Paid, Rounded Up Number>
    secret: <Payment Preimage Hex String>
    [timeout]: <Expiration Block Height Number>
    tokens: <Total Tokens Paid Rounded Down Number>
  }
*/
module.exports = payment => {
  if (!payment) {
    throw new Error('ExpectedConfirmedPaymentToDeriveConfirmationDetails');
  }

  if (!payment.fee_msat) {
    throw new Error('ExpectedPaymentFeeMillitokensAmountForPayment');
  }

  if (!isArray(payment.htlcs)) {
    throw new Error('ExpectedArrayOfPaymentHtlcsInConfirmedPayment');
  }

  if (!payment.htlcs.find(n => n.status === attemptStates.confirmed)) {
    throw new Error('ExpectedSuccessHtlcInConfirmedPayment');
  }

  if (!is256Hex(payment.payment_hash)) {
    throw new Error('ExpectedPaymentHashForPaymentAsConfirmedPayment');
  }

  if (!is256Hex(payment.payment_preimage)) {
    throw new Error('ExpectedPaymentPreimageForPaymentAsConfirmedPayment');
  }

  if (mtokensAsTokens(payment.value_msat) !== Number(payment.value_sat)) {
    throw new Error('ExpectedValueOfTokensAndMillitokensToBeConsistent');
  }

  const attempts = payment.htlcs.map(htlc => rpcAttemptHtlcAsAttempt(htlc));
  const mtokens = BigInt(payment.value_msat) + BigInt(payment.fee_msat);

  const successes = attempts.filter(n => n.is_confirmed);

  const [success] = successes;

  return {
    fee: safeTokens({mtokens: payment.fee_msat}).tokens,
    fee_mtokens: payment.fee_msat,
    hops: success.route.hops,
    id: payment.payment_hash,
    mtokens: mtokens.toString(),
    paths: successes.map(n => n.route),
    safe_fee: safeTokens({mtokens: payment.fee_msat}).safe,
    safe_tokens: safeTokens({mtokens: mtokens.toString()}).safe,
    secret: payment.payment_preimage,
    timeout: max(...successes.map(n => n.route.timeout).filter(n => !!n)),
    tokens: safeTokens({mtokens: mtokens.toString()}).tokens,
  };
};
