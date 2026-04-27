param(
  [int]$Port = 4173
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Any, $Port)
$listener.Start()

$ips = [Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() |
  Where-Object { $_.OperationalStatus -eq "Up" } |
  ForEach-Object { $_.GetIPProperties().UnicastAddresses } |
  Where-Object { $_.Address.AddressFamily -eq [Net.Sockets.AddressFamily]::InterNetwork -and -not [Net.IPAddress]::IsLoopback($_.Address) } |
  ForEach-Object { $_.Address.ToString() }

Write-Host "Local: http://127.0.0.1:$Port"
foreach ($ip in $ips) {
  Write-Host "Phone on same Wi-Fi: http://$ip`:$Port"
}

$types = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".svg" = "image/svg+xml; charset=utf-8"
  ".webmanifest" = "application/manifest+json; charset=utf-8"
}

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    $reader = [IO.StreamReader]::new($stream, [Text.Encoding]::ASCII, $false, 1024, $true)
    $requestLine = $reader.ReadLine()
    if (-not $requestLine) {
      $client.Close()
      continue
    }

    while ($reader.ReadLine()) {}

    $parts = $requestLine.Split(" ")
    $requestPath = [Uri]::UnescapeDataString($parts[1].Split("?")[0])
    if ($requestPath -eq "/" -or [IO.Path]::GetExtension($requestPath) -eq "") {
      $requestPath = "/index.html"
    }

    $relative = $requestPath.TrimStart("/").Replace("/", [IO.Path]::DirectorySeparatorChar)
    $filePath = [IO.Path]::GetFullPath([IO.Path]::Combine($root, $relative))
    $rootPath = [IO.Path]::GetFullPath($root)

    if (-not $filePath.StartsWith($rootPath) -or -not [IO.File]::Exists($filePath)) {
      $status = "404 Not Found"
      $contentType = "text/plain; charset=utf-8"
      $body = [Text.Encoding]::UTF8.GetBytes("Not found")
    } else {
      $status = "200 OK"
      $ext = [IO.Path]::GetExtension($filePath)
      $contentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { "application/octet-stream" }
      $body = [IO.File]::ReadAllBytes($filePath)
    }

    $headers = "HTTP/1.1 $status`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
    $headerBytes = [Text.Encoding]::ASCII.GetBytes($headers)
    $stream.Write($headerBytes, 0, $headerBytes.Length)
    $stream.Write($body, 0, $body.Length)
  } finally {
    $client.Close()
  }
}
