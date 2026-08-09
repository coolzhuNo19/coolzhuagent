# Coolzhu Agent 开发签名说明

开发证书只用于受控测试电脑，不适用于公开发布，也不能替代商业代码签名证书或 Microsoft Trusted Signing。

## 测试电脑信任步骤

1. 核对 `CoolzhuAgent-Development-Publisher.cer` 的 SHA-256/指纹与发布说明完全一致。
2. 双击证书，选择“安装证书”。
3. 个人测试机可选择“当前用户”，把证书明确放入“受信任的根证书颁发机构”。
4. 再次导入同一证书，放入“受信任的发布者”。如果电脑启用了企业 WDAC/AppLocker
   或按计算机生效的策略，需要管理员批准并改为“本地计算机”证书库，不能由应用绕过。
5. 安装 MSI 前，在文件属性的“数字签名”页核对发布者和证书指纹。

不要通过安装包静默安装根证书。测试结束后，应从当前用户的“受信任的根证书颁发机构”、
“受信任的发布者”和“个人”存储区删除开发证书。

## 正式发布

构建机应使用受信任的代码签名证书，并通过证书指纹或 PFX 路径调用：

```powershell
$env:COOLZHU_SIGNING_PFX_PASSWORD = '<仅在构建环境注入，不写入脚本>'
scripts/build-msi.ps1 `
  -Version 0.2.2 `
  -Configuration release `
  -PackageRoot tmp/package-0.2.2 `
  -SigningPfxPath C:\secure\coolzhu-release.pfx `
  -RequireSigned
```

也可以使用已安装在证书库中的证书：

```powershell
scripts/build-msi.ps1 `
  -Version 0.2.2 `
  -Configuration release `
  -PackageRoot tmp/package-0.2.2 `
  -SigningCertificateThumbprint '<证书指纹>' `
  -RequireSigned
```

默认会为全部入口 EXE/DLL 和最终 MSI 添加 SHA-256 Authenticode 签名及时间戳。
任何文件签名或验签失败都会终止打包。
