<?php
declare(strict_types=1);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit('不允许的请求方法。');
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
        exit("缺少必填字段。");
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        exit("邮箱地址无效。");
    }

    // 📧 Email destination
    $to = "formulaire.obf@gmail.com";

    $subject = '新的报价申请 - One Billion Forwarders';

    $body = "收到来自 One Billion Forwarders 网站的新请求。\n\n";
    $body .= "姓名 / 公司：$name\n";
    $body .= "邮箱：$email\n";
    if ($company !== '') { $body .= "公司：$company\n"; }
    $body .= "\n留言：\n$message\n";

    $headers = [];
    $headers[] = 'MIME-Version: 1.0';
    $headers[] = 'Content-Type: text/plain; charset=UTF-8';
    $headers[] = 'From: One Billion Forwarders <formulaire.obf@gmail.com>';
    $headers[] = 'Reply-To: ' . $email;
    $headers = implode("\r\n", $headers);

    $encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    if (mail($to, $encodedSubject, $body, $headers)) {
        header("Location: /cn/contact-success.html");
        exit;
    } else {
        http_response_code(500);
        echo "表单发送时发生错误。";
    }
