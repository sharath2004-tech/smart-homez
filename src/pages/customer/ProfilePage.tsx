import AppLayout from "@/components/AppLayout";
import { authAPI, locationsAPI, usersAPI } from "@/lib/api";
import { Bell, Check, ChevronRight, Edit2, Eye, EyeOff, Loader2, MapPin, Plus, Star, Trash2, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface Address {
  _id: string;
  label: string;
  blockNo?: string;
  flatNo?: string;
  apartment?: string;
  area: string;
  city: string;
  zipCode?: string;
  isDefault: boolean;
}

interface PreferredWorker {
  name: string;
  rating: number;
  specialization: string[];
  jobsCount: number;
}

interface UserProfile {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  addresses: Address[];
}

interface Stats {
  totalBookings: number;
  preferredWorkers: PreferredWorker[];
  monthsActive: number;
}

const ProfilePage = () => {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<Stats>({ totalBookings: 0, preferredWorkers: [], monthsActive: 0 });
  const [loading, setLoading] = useState(true);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [newAddress, setNewAddress] = useState({
    label: 'Home',
    blockNo: '',
    flatNo: '',
    apartment: '',
    area: '',
    city: '',
    zipCode: ''
  });
  const [geocoding, setGeocoding] = useState(false);
  // Account settings modal
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountForm, setAccountForm] = useState({ name: '', email: '', phone: '' });
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [accountSuccess, setAccountSuccess] = useState('');
  // Change password
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [showPwd, setShowPwd] = useState({ current: false, next: false, confirm: false });

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const [profileData, statsData] = await Promise.all([
        authAPI.getProfile(),
        usersAPI.getStats()
      ]);
      const user = profileData.user || profileData;
      setProfile(user);
      setStats(statsData.stats || statsData);
      setAccountForm({ name: user.name || '', email: user.email || '', phone: user.phone || '' });
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const isValidName = (value: string) => {
    // Must be at least 3 characters
    if (value.length < 3) return false;
    // Must contain at least one vowel (filters out random consonant strings like "wefnjk")
    if (!/[aeiouAEIOU]/.test(value)) return false;
    // Must be mostly letters/spaces/hyphens/dots (allow some digits for addresses like "Sector 5")
    if (!/^[a-zA-Z\s.'-]+( \d{1,4})?$/.test(value) && !/^[a-zA-Z0-9\s.,'()-]+$/.test(value)) return false;
    // Reject if more than 60% characters are non-alphabetic
    const alphaCount = (value.match(/[a-zA-Z]/g) || []).length;
    if (alphaCount / value.length < 0.4) return false;
    return true;
  };

  const handleAddAddress = async () => {
    setAddressError("");
    // Validate area and city are non-empty text (not purely numeric)
    const areaVal = newAddress.area.trim();
    const cityVal = newAddress.city.trim();
    const zipVal = newAddress.zipCode.trim();
    const flatVal = newAddress.flatNo.trim();
    if (!areaVal || !cityVal) {
      setAddressError(t('customer.profile.areaAndCityRequired'));
      return;
    }
    if (/^\d+$/.test(areaVal)) {
      setAddressError(t('customer.profile.areaCannotBeNumbers'));
      return;
    }
    if (/^\d+$/.test(cityVal)) {
      setAddressError(t('customer.profile.cityCannotBeNumbers'));
      return;
    }
    if (!isValidName(areaVal)) {
      setAddressError(t('customer.profile.invalidArea'));
      return;
    }
    if (!isValidName(cityVal)) {
      setAddressError(t('customer.profile.invalidCity'));
      return;
    }
    if (flatVal && !/^[a-zA-Z0-9\s/,.-]{1,20}$/.test(flatVal)) {
      setAddressError('Invalid flat number.');
      return;
    }
    if (zipVal && !/^\d{6}$/.test(zipVal)) {
      setAddressError(t('customer.profile.zipCodeInvalid'));
      return;
    }
    // Validate city is serviceable
    try {
      setGeocoding(true);
      const locRes = await locationsAPI.getAllLocations();
      const locations: { city?: string }[] = locRes.locations || locRes.data || [];
      const serviceableCities = locations.map((l) => (l.city || '').toLowerCase().trim());
      if (serviceableCities.length > 0 && !serviceableCities.some((c) => c === cityVal.toLowerCase())) {
        setAddressError(`"${cityVal}" is not in our serviceable cities yet. Available: ${locations.map((l) => l.city).filter(Boolean).join(', ')}.`);
        setGeocoding(false);
        return;
      }
    } catch {
      // If city check fails, proceed anyway
    }
    try {
      
      // Geocode the address using OpenStreetMap
      const coordinates = await locationsAPI.geocode({
        area: newAddress.area,
        city: newAddress.city,
        zipCode: newAddress.zipCode
      });

      await usersAPI.addAddress({
        label: newAddress.label,
        blockNo: newAddress.blockNo,
        flatNo: newAddress.flatNo,
        area: newAddress.area,
        city: newAddress.city,
        zipCode: newAddress.zipCode,
        location: {
          type: 'Point',
          coordinates: [coordinates.data.longitude, coordinates.data.latitude]
        },
        isDefault: profile?.addresses.length === 0
      });

      // Reset form
      setNewAddress({ label: 'Home', blockNo: '', flatNo: '', apartment: '', area: '', city: '', zipCode: '' });
      setShowAddressForm(false);
      
      // Refresh profile
      await fetchProfileData();
    } catch (error) {
      console.error('Error adding address:', error);
      alert(t('customer.profile.failedToAddAddress'));
    } finally {
      setGeocoding(false);
    }
  };

  const handleSaveAccount = async () => {
    setAccountError('');
    setAccountSuccess('');
    if (!accountForm.email.includes('@')) {
      setAccountError(t('customer.profile.invalidEmail'));
      return;
    }
    if (accountForm.phone && !/^[+]?[\d\s()-]{7,15}$/.test(accountForm.phone)) {
      setAccountError(t('customer.profile.invalidPhone'));
      return;
    }
    try {
      setAccountSaving(true);
      await authAPI.updateProfile({ name: accountForm.name, email: accountForm.email, phone: accountForm.phone });
      // Update localStorage
      try {
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({ ...stored, name: accountForm.name, email: accountForm.email }));
      } catch (_e) {
        // localStorage unavailable
      }
      setAccountSuccess(t('customer.profile.profileUpdated'));
      await fetchProfileData();
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : t('customer.profile.failedToUpdate'));
    } finally {
      setAccountSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    if (!passwordForm.current) { setPasswordError(t('customer.profile.enterCurrentPassword')); return; }
    if (passwordForm.next.length < 8) { setPasswordError(t('customer.profile.passwordMinLength')); return; }
    if (passwordForm.next !== passwordForm.confirm) { setPasswordError(t('customer.profile.passwordsDoNotMatch')); return; }
    try {
      setPasswordSaving(true);
      await authAPI.changePassword(passwordForm.current, passwordForm.next);
      setPasswordForm({ current: '', next: '', confirm: '' });
      setShowPasswordSection(false);
      setAccountSuccess(t('customer.profile.passwordChanged'));
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : t('customer.profile.failedToChangePassword'));
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!confirm(t('customer.profile.confirmDeleteAddress'))) return;
    
    try {
      await usersAPI.deleteAddress(addressId);
      await fetchProfileData();
    } catch (error) {
      console.error('Error deleting address:', error);
      alert(t('customer.profile.failedToDeleteAddress'));
    }
  };

  const handleSetDefaultAddress = async (addressId: string) => {
    try {
      await usersAPI.setDefaultAddress(addressId);
      await fetchProfileData();
    } catch (error) {
      console.error('Error setting default address:', error);
      alert(t('customer.profile.failedToSetDefault'));
    }
  };

  const handleUseCurrentLocation = async () => {
    alert('Please enable location access and try again — use the GPS icon after allowing location permission.');
  };

  if (loading) {
    return (
      <AppLayout userType="customer" userName="Loading...">
        <div className="max-w-2xl mx-auto flex items-center justify-center py-20">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout userType="customer" userName="Guest">
        <div className="max-w-2xl mx-auto text-center py-20">
          <div className="text-4xl mb-4">👤</div>
          <h2 className="text-xl font-bold mb-2">{t('customer.profile.pleaseLogIn')}</h2>
          <p className="text-muted-foreground mb-4">{t('customer.profile.needToBeLoggedIn')}</p>
          <a href="/login" className="btn-brand px-6 py-2 inline-block">
            {t('customer.profile.goToLogin')}
          </a>
        </div>
      </AppLayout>
    );
  }

  const initials = profile.name.split(' ').map(n => n[0]).join('').toUpperCase();

  return (
    <AppLayout userType="customer" userName={profile.name}>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 md:px-6 space-y-6 animate-fade-in pb-20 md:pb-0">
        {/* Profile header */}
        <div className="card-elevated p-4 sm:p-5 md:p-6 text-center relative">
          <button onClick={() => setShowAccountModal(true)} className="absolute top-4 right-4 p-2 bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors" title="Edit profile">
            <Edit2 className="w-4 h-4" />
          </button>
          <div className="w-20 h-20 bg-primary-light rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-primary/20">
            <span className="text-2xl font-bold text-primary">{initials}</span>
          </div>
          <h2 className="text-xl font-bold font-heading text-foreground">{profile.name}</h2>
          <p className="text-muted-foreground text-sm mt-1">{profile.email}</p>
          {profile.phone && <p className="text-muted-foreground text-sm">{profile.phone}</p>}
          <div className="flex items-center justify-center gap-1 mt-3">
            <Star className="w-4 h-4 fill-warning text-warning" />
            <span className="text-sm font-semibold text-foreground">{t('customer.profile.customer')}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="card-elevated p-4 text-center">
          <p className="text-2xl font-bold font-heading text-foreground">{stats.totalBookings}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t('customer.profile.totalBookings')}</p>
        </div>

        {/* Saved addresses */}
        <div className="card-elevated p-5">
          <h3 className="font-bold font-heading text-foreground mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" /> {t('customer.profile.savedAddresses')}
          </h3>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
            </div>
          ) : profile.addresses.length === 0 ? (
            <div className="text-center py-8">
              <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm text-muted-foreground">{t('customer.profile.noAddressesSaved')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {profile.addresses.map((addr) => (
                <div key={addr._id} className="flex items-start gap-3 p-3 bg-muted rounded-xl group">
                  <div className="w-8 h-8 bg-primary-light rounded-lg flex items-center justify-center shrink-0">
                    <MapPin className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground">{addr.label}</p>
                      {addr.isDefault && <span className="badge-primary text-xs">Default</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[addr.flatNo, addr.blockNo, addr.area, addr.city, addr.zipCode].filter(Boolean).join(', ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!addr.isDefault && (
                      <button
                        onClick={() => handleSetDefaultAddress(addr._id)}
                        className="p-1.5 hover:bg-primary/10 rounded-lg text-primary"
                        title="Set as default"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteAddress(addr._id)}
                      className="p-1.5 hover:bg-destructive/10 rounded-lg text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

              {addressError && (
                <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive">
                  {addressError}
                </div>
              )}
              {showAddressForm ? (
            <div className="mt-4 p-4 border-2 border-primary/20 rounded-xl bg-primary/5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground">{t('customer.profile.addNewAddress')}</h4>
                <button
                  onClick={() => setShowAddressForm(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {t('customer.profile.cancel')}
                </button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  className="input-clean text-sm col-span-2"
                  value={newAddress.label}
                  onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}
                >
                  <option value="Home">Home</option>
                  <option value="Office">Office</option>
                  <option value="Commercial Space">Commercial Space</option>
                </select>
                <input
                  type="text"
                  placeholder="Apartment Name"
                  className="input-clean text-sm col-span-2"
                  value={newAddress.apartment}
                  onChange={(e) => setNewAddress({ ...newAddress, apartment: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Block no. (optional)"
                  className="input-clean text-sm"
                  value={newAddress.blockNo}
                  onChange={(e) => setNewAddress({ ...newAddress, blockNo: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Flat no."
                  className="input-clean text-sm"
                  value={newAddress.flatNo}
                  onChange={(e) => setNewAddress({ ...newAddress, flatNo: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Area *"
                  className="input-clean text-sm"
                  value={newAddress.area}
                  onChange={(e) => { setNewAddress({ ...newAddress, area: e.target.value }); setAddressError(''); }}
                  required
                />
                <input
                  type="text"
                  placeholder="City *"
                  className="input-clean text-sm"
                  value={newAddress.city}
                  onChange={(e) => { setNewAddress({ ...newAddress, city: e.target.value }); setAddressError(''); }}
                  required
                />
                <input
                  type="text"
                  placeholder="ZIP Code"
                  className="input-clean text-sm col-span-2"
                  value={newAddress.zipCode}
                  onChange={(e) => setNewAddress({ ...newAddress, zipCode: e.target.value })}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleAddAddress}
                  disabled={!newAddress.area || !newAddress.city || geocoding}
                  className="flex-1 btn-brand py-2 text-xs disabled:opacity-50"
                >
                  {geocoding ? t('customer.profile.adding') : t('customer.profile.addAddress')}
                </button>
              </div>
            </div>
              ) : (
            <button
              onClick={() => { setShowAddressForm(true); setAddressError(''); }}
              className="w-full mt-3 py-2.5 border-2 border-dashed border-border rounded-xl text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> {t('customer.profile.addNewAddress')}
            </button>
          )}
        </div>



        {/* Settings */}
        <div className="card-elevated overflow-hidden">
          {[
            { icon: Bell, label: t('customer.profile.notifications'), desc: t('customer.profile.notificationsDesc'), onClick: () => {} },
            { icon: User, label: t('customer.profile.accountSettings'), desc: t('customer.profile.accountSettingsDesc'), onClick: () => setShowAccountModal(true) },
          ].map((item, i) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className={`w-full flex items-center gap-4 p-4 hover:bg-muted transition-colors text-left ${i > 0 ? "border-t border-border" : ""}`}
            >
              <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shrink-0">
                <item.icon className="w-4 h-4 text-accent-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
        </div>

        {/* Account Settings Modal */}
        {showAccountModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50">
            <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold font-heading text-foreground">{t('customer.profile.accountSettings')}</h3>
                <button onClick={() => { setShowAccountModal(false); setAccountError(''); setAccountSuccess(''); setShowPasswordSection(false); }} className="text-muted-foreground hover:text-foreground p-1">
                  ✕
                </button>
              </div>

              {accountError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive">{accountError}</div>
              )}
              {accountSuccess && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700">{accountSuccess}</div>
              )}

              {/* Only email and phone editable */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('customer.profile.fullName')}</label>
                  <input
                    type="text"
                    className="input-clean"
                    value={accountForm.name}
                    onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('customer.profile.emailLabel')}</label>
                  <input
                    type="email"
                    className="input-clean"
                    value={accountForm.email}
                    onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })}
                    placeholder="you@email.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{t('customer.profile.phoneLabel')}</label>
                  <input
                    type="tel"
                    className="input-clean"
                    value={accountForm.phone}
                    onChange={(e) => setAccountForm({ ...accountForm, phone: e.target.value })}
                    placeholder="+91 XXXXXXXXXX"
                  />
                </div>
              </div>

              <button
                onClick={handleSaveAccount}
                disabled={accountSaving}
                className="w-full btn-brand py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {accountSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {accountSaving ? t('customer.profile.saving') : t('customer.profile.saveChanges')}
              </button>

              {/* Change Password */}
              <div className="border-t border-border pt-4">
                <button
                  onClick={() => setShowPasswordSection(!showPasswordSection)}
                  className="text-sm text-primary font-medium hover:underline"
                >
                  {showPasswordSection ? t('customer.profile.hidePasswordChange') : t('customer.profile.changePassword')}
                </button>

                {showPasswordSection && (
                  <div className="mt-3 space-y-3">
                    {passwordError && (
                      <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive">{passwordError}</div>
                    )}
                    {(['current', 'next', 'confirm'] as const).map((field) => (
                      <div key={field} className="relative">
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {field === 'current' ? t('customer.profile.currentPassword') : field === 'next' ? t('customer.profile.newPassword') : t('customer.profile.confirmNewPassword')}
                        </label>
                        <input
                          type={showPwd[field] ? 'text' : 'password'}
                          className="input-clean pr-10"
                          value={passwordForm[field]}
                          onChange={(e) => setPasswordForm({ ...passwordForm, [field]: e.target.value })}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPwd({ ...showPwd, [field]: !showPwd[field] })}
                          className="absolute right-3 top-[calc(50%+8px)] -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPwd[field] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={handleChangePassword}
                      disabled={passwordSaving}
                      className="w-full btn-brand py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {passwordSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      {passwordSaving ? t('customer.profile.changing') : t('customer.profile.changePassword')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default ProfilePage;
