<?php
header('Content-Type: application/json');

$data = [
    'merchantId' => '123456',
    'referenceNo' => $_POST['orderid'] ?? '',
    'txnType' => $_POST['tcctype'] ?? 'SALS',
    'txnCurrency' => $_POST['currency'] ?? '',
    'txnAmount' => $_POST['total_amount'] ?? '1.00',
    'custName' => ($_POST['billingFirstName'] ?? '') . ' ' . ($_POST['billingLastName'] ?? ''),
    'custEmail' => $_POST['billingEmail'] ?? '',
    'custContact' => $_POST['billingMobile'] ?? '',
    'returnUrl' => 'https://example.com/return',
    'callbackUrl' => 'https://example.com/callback'
];

echo json_encode($data);
?>
