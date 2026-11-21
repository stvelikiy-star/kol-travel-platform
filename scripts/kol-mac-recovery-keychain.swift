import Foundation
import Security

func stop(_ message: String) -> Never {
    fputs("KOL Mac Keychain escrow: " + message + "\n", stderr)
    exit(2)
}

let wire = FileHandle.standardInput.readDataToEndOfFile()
guard wire.count > 32, let decoded = String(data: wire, encoding: .utf8) else {
    stop("Missing encrypted SSH transfer input")
}
let secret = decoded.trimmingCharacters(in: .newlines)
guard secret.count >= 32, !secret.contains("\n"), !secret.contains("\r") else {
    stop("Invalid recovery key payload")
}
let secretData = Data(secret.utf8)
let service = "KOL-OFFSITE-RECOVERY-2026"
let account = "KOL_BACKUP_KEY"
let lookup: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: service,
    kSecAttrAccount as String: account,
    kSecMatchLimit as String: kSecMatchLimitOne,
    kSecReturnData as String: true
]
var existing: CFTypeRef?
let found = SecItemCopyMatching(lookup as CFDictionary, &existing)
if found == errSecSuccess {
    guard let stored = existing as? Data else {
        stop("Existing Keychain record could not be read")
    }
    guard stored == secretData else {
        stop("A different recovery key already exists; refusing silent overwrite")
    }
    print("KOL_MAC_KEYCHAIN_ESCROW_ALREADY_PRESENT_MATCHES_PASS")
    exit(0)
}
guard found == errSecItemNotFound else {
    stop("macOS Keychain lookup error " + String(found))
}
let add: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: service,
    kSecAttrAccount as String: account,
    kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
    kSecValueData as String: secretData
]
let added = SecItemAdd(add as CFDictionary, nil)
guard added == errSecSuccess else {
    stop("Keychain write error " + String(added))
}
var readback: CFTypeRef?
let confirmed = SecItemCopyMatching(lookup as CFDictionary, &readback)
guard confirmed == errSecSuccess, let recovered = readback as? Data, recovered == secretData else {
    stop("Keychain readback failed")
}
print("KOL_MAC_KEYCHAIN_ESCROW_READBACK_PASS")
print("The recovery key is stored on this Mac; no secret printed.")
