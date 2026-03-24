<?php
declare(strict_types=1);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit('Method not allowed.');
}

    // 🔒 Sécurisation basique
    function clean($v) { return trim((string)$v); }
    $name = clean($_POST["name"] ?? "");
    $email = clean($_POST["email"] ?? "");
    $company = clean($_POST["company"] ?? "");
    $message = clean($_POST["message"] ?? "");

    // Prevent header injection
    $email = str_replace(["\r", "\n"], '', $email);

    // ❌ Vérification
    if (empty($name) || empty($email) || empty($message)) {
        http_response_code(400);
        exit("Required fields are missing.");
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        exit("Invalid email address.");
    }

    // 📧 Email destination
    $to = "formulaire.obf@gmail.com";

    $subject = 'New quote request - One Billion Forwarders';

    $body = "New request received from the One Billion Forwarders website.\n\n";
    $body .= "Name / Company: $name\n";
    $body .= "Email: $email\n";
    if ($company !== '') { $body .= "Company: $company\n"; }
    $body .= "\nMessage:\n$message\n";

    $headers = [];
    $headers[] = 'MIME-Version: 1.0';
    $headers[] = 'Content-Type: text/plain; charset=UTF-8';
    $headers[] = 'From: One Billion Forwarders <formulaire.obf@gmail.com>';
    $headers[] = 'Reply-To: ' . $email;
    $headers = implode("\r\n", $headers);

    $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    if (mail($to, $encodedSubject, $body, $headers)) {
        header("Location: /en/contact-success.html");
        exit;
    } else {
        http_response_code(500);
        echo "An error occurred while sending the form.";
    }
