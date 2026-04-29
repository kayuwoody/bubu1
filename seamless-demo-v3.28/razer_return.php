<?php
$vkey ="{{verify_key}}"; //Replace with your Razer Verify Key
header("Location: index2.html");
exit;
/********************************
*Don't change below parameters
********************************/
$tranID     =    $_POST['tranID'];
$orderid     =    $_POST['orderid'];
$status     =    $_POST['status'];
$domain     =    $_POST['domain'];
$amount     =    $_POST['amount'];
$currency     =    $_POST['currency'];
$appcode     =    $_POST['appcode'];
$paydate     =    $_POST['paydate'];
$skey        =    $_POST['skey'];

/***********************************************************
* To verify the data integrity sending by Razer
************************************************************/
$key0 = md5( $tranID.$orderid.$status.$domain.$amount.$currency );
$key1 = md5( $paydate.$domain.$key0.$appcode.$vkey );

if( $skey != $key1 ) $status= -1; // Invalid transaction. 
// Merchant might issue a requery to Razer to double check payment status with Razer.

if ( $status == "00" ) {
  if ( check_cart_amt($orderid, $amount) ) {
  /*** NOTE : this is a user-defined function which should be prepared by merchant ***/
  // action to change cart status or to accept order
  // you can also do further checking on the paydate as well
  // write your script here .....
  }
} else {
  // failure action. Write your script here .....
  // Merchant might send query to Razer using Merchant requery
  // to double check payment status for that particular order.
}

// Merchant is recommended to implement IPN once received the payment status
// regardless the status to acknowledge Razer system

header("Location: index.html");
exit;

function check_cart_amt( $orderid, $amount )
{
  /*** NOTE : this is a user-defined function which should be prepared by merchant ***/
	return true;
}
?>