<?php
/*** Start Processing Submitted Form Above ***/
if( isset($_POST['payment_options']) && $_POST['payment_options'] != "" ) {

	$merchantid = "{{merchant_id}}";	// Change to your merchant ID
	$vkey = "{{verify_key}}";	// Change to your verify key
	
 // Put your own code/process HERE. (Eg: Insert data to DB)
 $your_orderid = "TEST".rand();
 $your_process_status = true;
 
	if( $your_process_status === true ) {
		$params = array(
			'status'          => true,	// Set True to proceed with Razer
			'mpsmerchantid'   => $merchantid,
			'mpschannel'      => $_POST['payment_options'],
			'mpsamount'       => $_POST['total_amount'],
			'mpsorderid'      => $your_orderid,
			'mpsbill_name'    => $_POST['billingFirstName']." ".$_POST['billingLastName'],
			'mpsbill_email'   => $_POST['billingEmail'],
			'mpsbill_mobile'  => $_POST['billingMobile'],
			'mpsbill_desc'    => $_POST['billingAddress'],
			'mpscountry'      => "MY",
			'mpsvcode'        => md5($_POST['total_amount'].$merchantid.$your_orderid.$vkey),
			'mpscurrency'     => $_POST['currency'],
			'mpslangcode'     => "en",
			//'mpsextra'     	  => base64_encode("1#mpd_tonton:10.00"),
			'mpstimer'	      => isset($_POST['razertimer']) ?(int)$_POST['razertimer'] : '',
			'mpstimerbox'	  => "#counter",
			'mpscancelurl'	  => "http://localhost/seamless-demo-v3.28/cancel_order.php",
			'mpsreturnurl'    => "http://localhost/seamless-demo-v3.28/razer_return.php",
			'mpsapiversion'   => "3.28"
		);
	} elseif( $your_process_status === false ) {
		$params = array(
			'status'          => false,      // Set False to show an error message.
			'error_code'	  => "Your Error Code (Eg: 500)",
			'error_desc'      => "Your Error Description (Eg: Internal Server Error)",
			'failureurl'      => "index.html"
		);
	}
}
else
{
	$params = array(
		'status'          => false,      // Set False to show an error message.
		'error_code'	  => "500",
		'error_desc'      => "Internal Server Error",
		'failureurl'      => "index.html"
	);
}
echo json_encode( $params );
exit();
?>